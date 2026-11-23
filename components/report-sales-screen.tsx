"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api, apiFile } from '@/lib/api';

type Row = Record<string, any>;
type Report = {
  period: { from: string; to: string; generatedAt: string; basis?: string; currency?: string; liveSource?: boolean };
  definitions: Row[];
  totals: {
    invoiceCount: number;
    postedInvoiceExTax: number;
    soldCopies: number;
    postedReturnCount: number;
    returnedCopies: number;
    proposedReturnCredit: number;
  };
  channels: Row[];
  monthly: Row[];
  monthlyReturns?: Row[];
  returnChannels?: Row[];
  invoices: Row[];
  returns: Row[];
  pagination: { limit: number; offset: number; totalInvoices: number; totalReturns: number };
  caveat: string;
};

const day = (value: unknown) => String(value || '').slice(0, 10);
const money = (value: unknown) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactMoney = (val: number) => {
  if (val >= 10000000) return `BDT ${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `BDT ${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `BDT ${(val / 1000).toFixed(1)}k`;
  return `BDT ${val.toFixed(0)}`;
};

const standardChannels = [
  { value: '', label: 'All Channels', icon: '🌐' },
  { value: 'bookstore', label: 'Retail & Bookstores', icon: '🏪' },
  { value: 'wholesale', label: 'Wholesale Distributors', icon: '📦' },
  { value: 'online', label: 'E-commerce & Web', icon: '💻' },
  { value: 'institution', label: 'Academic & Libraries', icon: '🏛️' },
  { value: 'fair', label: 'Book Fair & Events', icon: '🎪' },
  { value: 'direct', label: 'Direct Publishing', icon: '🤝' },
];

function currentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}

function getPresetRange(preset: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const today = fmt(now);

  switch (preset) {
    case 'this_month': {
      const y = now.getFullYear();
      const m = pad(now.getMonth() + 1);
      return { from: `${y}-${m}-01`, to: today };
    }
    case 'last_30_days': {
      const past = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      return { from: fmt(past), to: today };
    }
    case 'last_90_days': {
      const past = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
      return { from: fmt(past), to: today };
    }
    case 'ytd': {
      return { from: `${now.getFullYear()}-01-01`, to: today };
    }
    case 'all_time': {
      return { from: `${now.getFullYear() - 2}-01-01`, to: today };
    }
    default:
      return null;
  }
}

export function ReportSalesScreen() {
  const initial = currentMonth();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [channel, setChannel] = useState('');
  const [transactionType, setTransactionType] = useState<'all' | 'sales' | 'returns'>('all');
  const [activePreset, setActivePreset] = useState<string>('last_90_days');
  const [applied, setApplied] = useState(() => {
    const r = getPresetRange('last_90_days') || initial;
    return { ...r, channel: '' };
  });

  const [activeTab, setActiveTab] = useState<'trends' | 'invoices' | 'returns' | 'definitions'>('trends');
  const [page, setPage] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [canExport, setCanExport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [hoveredMonth, setHoveredMonth] = useState<Row | null>(null);

  // Sync inputs with initial preset
  useEffect(() => {
    const r = getPresetRange('last_90_days');
    if (r) {
      setFrom(r.from);
      setTo(r.to);
    }
  }, []);

  const params = useMemo(() => {
    return new URLSearchParams({ ...applied, limit: '20', offset: String(page * 20) });
  }, [applied, page]);

  useEffect(() => {
    api<{ data: { role: string; permissions: string[] } }>('/auth/me')
      .then(res => setCanExport(res.data.role === 'Owner' || res.data.permissions.includes('reports.export')))
      .catch(() => setCanExport(false));
  }, []);

  const fetchReport = () => {
    setLoading(true);
    setError('');
    api<{ data: Report }>(`/reports/sales-returns?${params}`)
      .then(res => setReport(res.data))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Report failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport();
  }, [applied.from, applied.to, applied.channel, page]);

  const handleApplyPreset = (preset: string) => {
    setActivePreset(preset);
    const range = getPresetRange(preset);
    if (range) {
      setFrom(range.from);
      setTo(range.to);
      setPage(0);
      setApplied(curr => ({ ...curr, from: range.from, to: range.to }));
    }
  };

  const handleSelectChannel = (chanVal: string) => {
    setChannel(chanVal);
    setPage(0);
    setApplied(curr => ({ ...curr, channel: chanVal }));
  };

  const handleSelectTransactionType = (type: 'all' | 'sales' | 'returns') => {
    setTransactionType(type);
    setPage(0);
    if (type === 'sales') {
      setActiveTab('invoices');
    } else if (type === 'returns') {
      setActiveTab('returns');
    } else {
      setActiveTab('trends');
    }
  };

  const handleApplyFilters = () => {
    if (!from || !to || from > to) return;
    setActivePreset('custom');
    setPage(0);
    setApplied({ from, to, channel: channel.trim() });
  };

  const handleResetFilters = () => {
    const resetRange = getPresetRange('last_90_days') || currentMonth();
    setFrom(resetRange.from);
    setTo(resetRange.to);
    setChannel('');
    setTransactionType('all');
    setActivePreset('last_90_days');
    setPage(0);
    setApplied({ ...resetRange, channel: '' });
  };

  async function exportCsv() {
    setError('');
    try {
      const blob = await apiFile(`/reports/sales-returns/export.csv?${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sales-returns-${applied.from}-to-${applied.to}${applied.channel ? `-${applied.channel}` : ''}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportNotice('CSV report downloaded successfully.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed');
    }
  }

  async function queueExport() {
    setError('');
    setExportNotice('');
    try {
      await api('/reports/export-jobs', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(applied),
      });
      setExportNotice('Full background CSV export job queued.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not queue export');
    }
  }

  // Analytics calculations
  const totals = report?.totals || {
    invoiceCount: 0,
    postedInvoiceExTax: 0,
    soldCopies: 0,
    postedReturnCount: 0,
    returnedCopies: 0,
    proposedReturnCredit: 0,
  };

  const salesExTax = Number(totals.postedInvoiceExTax || 0);
  const returnCredit = Number(totals.proposedReturnCredit || 0);
  const netEstimatedRevenue = salesExTax - returnCredit;
  const returnRatePercent = salesExTax > 0 ? ((returnCredit / salesExTax) * 100).toFixed(1) : '0.0';
  const averageInvoiceValue = totals.invoiceCount > 0 ? salesExTax / totals.invoiceCount : 0;
  const averageReturnCredit = totals.postedReturnCount > 0 ? returnCredit / totals.postedReturnCount : 0;

  const monthlyList = report?.monthly || [];
  const monthlyReturnsList = report?.monthlyReturns || [];
  const maxMonthlyAmount = Math.max(1, ...monthlyList.map(r => Number(r.ex_tax_amount || 0)));
  const maxReturnCreditAmount = Math.max(1, ...monthlyReturnsList.map(r => Number(r.proposed_credit || 0)));

  const channelList = report?.channels || [];
  const returnChannelList = report?.returnChannels || [];
  const totalChannelAmount = channelList.reduce((acc, c) => acc + Number(c.ex_tax_amount || 0), 0);
  const totalReturnChannelAmount = returnChannelList.reduce((acc, c) => acc + Number(c.proposed_credit || 0), 0);

  // Available channel options merged dynamically
  const channelOptions = useMemo(() => {
    const existing = new Set(standardChannels.map(c => c.value));
    const merged = [...standardChannels];
    for (const c of channelList) {
      if (c.channel && !existing.has(c.channel)) {
        merged.push({ value: c.channel, label: `${c.channel.replaceAll('_', ' ').toUpperCase()}`, icon: '🏷️' });
        existing.add(c.channel);
      }
    }
    return merged;
  }, [channelList]);

  return (
    <div suppressHydrationWarning style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Heading & Quick Actions */}
      <div className="page-heading" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px' }}>
              COMMERCIAL TELEMETRY
            </span>
            <span className="badge badge-green">Live MySQL Ledger</span>
            {applied.channel && (
              <span className="badge badge-blue">Channel: {applied.channel.toUpperCase()}</span>
            )}
            {transactionType !== 'all' && (
              <span className={`badge ${transactionType === 'sales' ? 'badge-blue' : 'badge-amber'}`}>
                {transactionType === 'sales' ? 'Sales Only' : 'Returns Only'}
              </span>
            )}
          </div>
          <h1 className="page-title">Sales &amp; Returns Reports</h1>
          <p className="muted">
            Audited BDT invoice billing and authorized return requests by source posting dates.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={() => fetchReport()}
            disabled={loading}
          >
            <span>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          {canExport && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => void exportCsv()}
              >
                <span>⬇</span>
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                className="btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => void queueExport()}
              >
                <span>⚡</span>
                <span>Queue Full Export</span>
              </button>
              <Link className="btn" href="/reports-analytics/export-job-history">
                Export Jobs ➔
              </Link>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert-error" role="alert">{error}</div>}
      {exportNotice && (
        <div className="alert-success" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{exportNotice}</span>
          <Link href="/reports-analytics/export-job-history" style={{ fontWeight: 600, color: 'inherit', textDecoration: 'underline' }}>
            View Export Queue
          </Link>
        </div>
      )}

      {/* Top Filter & View Controller Bar */}
      <section className="panel" style={{ padding: '18px 20px', borderRadius: '12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Row 1: Primary Transaction Type Switch (Sales vs Returns) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.04em' }}>
              Record Type:
            </span>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '3px' }}>
              {[
                { id: 'all', label: 'All Transactions', icon: '📊', count: totals.invoiceCount + totals.postedReturnCount },
                { id: 'sales', label: 'Sales Invoices', icon: '💳', count: totals.invoiceCount },
                { id: 'returns', label: 'Return Claims', icon: '📦', count: totals.postedReturnCount },
              ].map(opt => {
                const isSelected = transactionType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 700 : 500,
                      border: 'none',
                      background: isSelected ? (opt.id === 'returns' ? '#b45309' : 'var(--brand)') : 'transparent',
                      color: isSelected ? '#fff' : '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                    }}
                    onClick={() => handleSelectTransactionType(opt.id as any)}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                        color: isSelected ? '#fff' : '#64748b',
                        fontWeight: 700,
                      }}
                    >
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginRight: '4px' }}>
              Period:
            </span>
            {[
              { id: 'this_month', label: 'This Month' },
              { id: 'last_30_days', label: 'Last 30 Days' },
              { id: 'last_90_days', label: 'Last 90 Days' },
              { id: 'ytd', label: 'YTD' },
              { id: 'all_time', label: 'All Time' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                style={{
                  padding: '4px 10px',
                  borderRadius: '14px',
                  fontSize: '11.5px',
                  fontWeight: activePreset === p.id ? 700 : 500,
                  border: '1px solid',
                  borderColor: activePreset === p.id ? 'var(--brand)' : 'var(--line)',
                  background: activePreset === p.id ? 'var(--brand)' : '#f8fafc',
                  color: activePreset === p.id ? '#fff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleApplyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Sales Channels Interactive Quick Filter Pills */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.04em' }}>
              Sales Channel Filter:
            </span>
            {applied.channel && (
              <button
                type="button"
                onClick={() => handleSelectChannel('')}
                style={{ fontSize: '11px', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Clear Channel Filter ✕
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {channelOptions.map(opt => {
              const isSelected = applied.channel === opt.value;
              return (
                <button
                  key={opt.value || 'all'}
                  type="button"
                  onClick={() => handleSelectChannel(opt.value)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 13px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 700 : 500,
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--brand)' : '#e2e8f0',
                    background: isSelected ? '#eff6ff' : '#fff',
                    color: isSelected ? 'var(--brand)' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 1px 4px rgba(37,99,235,0.15)' : 'none',
                  }}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                  {isSelected && <span style={{ fontSize: '11px', color: 'var(--brand)' }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Date Bounds Inputs & Custom Filter Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) auto auto', gap: '12px', alignItems: 'flex-end', paddingTop: '10px', borderTop: '1px solid #f8fafc' }}>
          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>From Date</span>
            <input
              className="input"
              type="date"
              value={from}
              onChange={e => {
                setFrom(e.target.value);
                setActivePreset('custom');
              }}
            />
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>To Date</span>
            <input
              className="input"
              type="date"
              value={to}
              onChange={e => {
                setTo(e.target.value);
                setActivePreset('custom');
              }}
            />
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Channel Dropdown</span>
            <select
              className="input"
              value={channel}
              onChange={e => handleSelectChannel(e.target.value)}
              style={{ fontWeight: channel ? 700 : 400 }}
            >
              {channelOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn btn-primary"
            style={{ height: '40px', padding: '0 20px', fontWeight: 700 }}
            disabled={!from || !to || from > to}
            onClick={handleApplyFilters}
          >
            Apply Dates
          </button>

          <button
            type="button"
            className="btn"
            style={{ height: '40px', padding: '0 16px' }}
            onClick={handleResetFilters}
          >
            Reset
          </button>
        </div>

        {report && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--muted)', paddingTop: '6px' }}>
            <span>
              Span: <strong>{report.period.from}</strong> to <strong>{report.period.to}</strong>
              {applied.channel ? (
                <> · Channel: <strong style={{ color: 'var(--brand)' }}>{applied.channel.toUpperCase()}</strong></>
              ) : ' · All Channels'}
              {transactionType !== 'all' && (
                <> · View: <strong>{transactionType === 'sales' ? 'Sales Only' : 'Returns Only'}</strong></>
              )}
            </span>
            <span>Ledger generated: {new Date(report.period.generatedAt).toLocaleString('en-BD')}</span>
          </div>
        )}
      </section>

      {/* Top Telemetry KPI Bar - Dynamically adapts to transactionType */}
      <div className="stat-grid" style={{ marginTop: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {transactionType === 'sales' && (
          <>
            <div className="panel stat">
              <div className="stat-label">GROSS INVOICED (EX-TAX)</div>
              <div className="stat-value" style={{ color: '#047857' }}>
                BDT {money(salesExTax)}
              </div>
              <div className="stat-sub muted">{totals.invoiceCount} posted invoices</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">TOTAL COPIES SOLD</div>
              <div className="stat-value">{totals.soldCopies.toLocaleString()}</div>
              <div className="stat-sub muted">Physical units dispatched</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">AVERAGE INVOICE VALUE</div>
              <div className="stat-value" style={{ color: 'var(--brand)' }}>
                BDT {money(averageInvoiceValue)}
              </div>
              <div className="stat-sub muted">Gross billing per invoice</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">ACTIVE CHANNELS</div>
              <div className="stat-value">{channelList.length}</div>
              <div className="stat-sub muted">Revenue distribution streams</div>
            </div>
          </>
        )}

        {transactionType === 'returns' && (
          <>
            <div className="panel stat">
              <div className="stat-label">PROPOSED RETURN CREDIT</div>
              <div className="stat-value" style={{ color: '#b45309' }}>
                BDT {money(returnCredit)}
              </div>
              <div className="stat-sub muted">{totals.postedReturnCount} posted return claims</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">TOTAL RETURNED COPIES</div>
              <div className="stat-value" style={{ color: '#dc2626' }}>
                {totals.returnedCopies.toLocaleString()}
              </div>
              <div className="stat-sub muted">Units returned or damaged</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">AVERAGE RETURN CLAIM</div>
              <div className="stat-value" style={{ color: '#b45309' }}>
                BDT {money(averageReturnCredit)}
              </div>
              <div className="stat-sub muted">Credit value per claim</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">RETURN CLAIM RATE</div>
              <div className="stat-value compact" style={{ color: Number(returnRatePercent) > 5 ? '#dc2626' : '#047857' }}>
                {returnRatePercent}%
              </div>
              <div className="stat-sub muted">Ratio against gross sales</div>
            </div>
          </>
        )}

        {transactionType === 'all' && (
          <>
            <div className="panel stat">
              <div className="stat-label">GROSS INVOICED (EX-TAX)</div>
              <div className="stat-value" style={{ color: '#047857' }}>
                BDT {money(salesExTax)}
              </div>
              <div className="stat-sub muted">{totals.invoiceCount} posted invoices</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">TOTAL COPIES SOLD</div>
              <div className="stat-value">{totals.soldCopies.toLocaleString()}</div>
              <div className="stat-sub muted">Net physical units dispatched</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">RETURN PROPOSED CREDIT</div>
              <div className="stat-value" style={{ color: returnCredit > 0 ? '#b45309' : 'var(--text)' }}>
                BDT {money(returnCredit)}
              </div>
              <div className="stat-sub muted">{totals.postedReturnCount} posted return claims</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">RETURNED COPIES &amp; RATE</div>
              <div className="stat-value compact" style={{ color: Number(returnRatePercent) > 5 ? '#dc2626' : '#475569' }}>
                {totals.returnedCopies.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 600 }}>({returnRatePercent}%)</span>
              </div>
              <div className="stat-sub muted">Return claims vs. gross billing</div>
            </div>

            <div className="panel stat">
              <div className="stat-label">ESTIMATED NET POSITION</div>
              <div className="stat-value" style={{ color: 'var(--brand)' }}>
                BDT {money(netEstimatedRevenue)}
              </div>
              <div className="stat-sub muted">Ex-tax sales less proposed credit</div>
            </div>
          </>
        )}
      </div>

      {/* Visual Analytics & Simple Charts Section */}
      {report && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          
          {/* Chart 1: Dynamics based on transactionType */}
          {transactionType !== 'returns' ? (
            /* Monthly Invoiced Revenue Trend */
            <div className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                    Monthly Invoiced Revenue Trend
                  </h3>
                  <small className="muted">Ex-tax BDT billing by invoice calendar month</small>
                </div>
                <span className="badge badge-blue">Sales Trend</span>
              </div>

              {monthlyList.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '170px', padding: '10px 0 0', borderBottom: '2px solid #e2e8f0', overflowX: 'auto' }}>
                    {monthlyList.map(row => {
                      const amt = Number(row.ex_tax_amount || 0);
                      const heightPercent = Math.max(8, Math.round((amt / maxMonthlyAmount) * 100));
                      const isHovered = hoveredMonth?.month === row.month;

                      return (
                        <div
                          key={row.month}
                          style={{
                            flex: '1 1 54px',
                            minWidth: '54px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            justifyContent: 'flex-end',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={() => setHoveredMonth(row)}
                          onMouseLeave={() => setHoveredMonth(null)}
                        >
                          <div style={{ fontSize: '10.5px', fontWeight: 700, color: isHovered ? 'var(--brand)' : '#64748b', marginBottom: '4px' }}>
                            {compactMoney(amt)}
                          </div>
                          <div
                            style={{
                              width: '100%',
                              maxWidth: '38px',
                              height: `${heightPercent}%`,
                              background: isHovered ? 'var(--brand)' : 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
                              borderRadius: '5px 5px 0 0',
                              transition: 'all 0.2s ease',
                              boxShadow: isHovered ? '0 4px 12px rgba(37,99,235,0.3)' : 'none',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Month Axis Labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', overflowX: 'auto', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    {monthlyList.map(row => (
                      <div key={row.month} style={{ flex: '1 1 54px', minWidth: '54px', textAlign: 'center' }}>
                        <div>{row.month}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 400 }}>{row.invoices} inv</div>
                      </div>
                    ))}
                  </div>

                  {hoveredMonth && (
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Selected: <strong>{hoveredMonth.month}</strong></span>
                      <span>Invoiced: <strong style={{ color: '#047857' }}>BDT {money(hoveredMonth.ex_tax_amount)}</strong></span>
                      <span>Volume: <strong>{hoveredMonth.invoices} invoices</strong></span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="panel empty" style={{ minHeight: '160px', display: 'grid', placeItems: 'center' }}>
                  No posted invoices recorded for this filter selection.
                </div>
              )}
            </div>
          ) : (
            /* Monthly Return Credit Trend */
            <div className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                    Monthly Return Credit Trend
                  </h3>
                  <small className="muted">Authorized return credits by posting calendar month</small>
                </div>
                <span className="badge badge-amber">Returns Trend</span>
              </div>

              {monthlyReturnsList.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '170px', padding: '10px 0 0', borderBottom: '2px solid #e2e8f0', overflowX: 'auto' }}>
                    {monthlyReturnsList.map(row => {
                      const amt = Number(row.proposed_credit || 0);
                      const heightPercent = Math.max(10, Math.round((amt / maxReturnCreditAmount) * 100));

                      return (
                        <div
                          key={row.month}
                          style={{
                            flex: '1 1 54px',
                            minWidth: '54px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#b45309', marginBottom: '4px' }}>
                            {compactMoney(amt)}
                          </div>
                          <div
                            style={{
                              width: '100%',
                              maxWidth: '38px',
                              height: `${heightPercent}%`,
                              background: 'linear-gradient(180deg, #f59e0b, #d97706)',
                              borderRadius: '5px 5px 0 0',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Month Axis Labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', overflowX: 'auto', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    {monthlyReturnsList.map(row => (
                      <div key={row.month} style={{ flex: '1 1 54px', minWidth: '54px', textAlign: 'center' }}>
                        <div>{row.month}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 400 }}>{row.return_count} claims ({row.returned_copies} pcs)</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="panel empty" style={{ minHeight: '160px', display: 'grid', placeItems: 'center' }}>
                  No return claims recorded for this filter selection.
                </div>
              )}
            </div>
          )}

          {/* Chart 2: Channel Breakdown / Risk Profile */}
          {transactionType !== 'returns' ? (
            /* Channel Revenue Distribution */
            <div className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                      Channel Revenue Distribution
                    </h3>
                    <small className="muted">Sales volume breakdown across distribution pathways</small>
                  </div>
                  <span className="badge badge-green">{channelList.length} Channels</span>
                </div>

                {channelList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {channelList.map(c => {
                      const amt = Number(c.ex_tax_amount || 0);
                      const pct = totalChannelAmount > 0 ? ((amt / totalChannelAmount) * 100).toFixed(1) : '0';
                      const isSelectedChannel = applied.channel === c.channel;

                      return (
                        <div
                          key={c.channel}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            background: isSelectedChannel ? '#eff6ff' : 'transparent',
                          }}
                          onClick={() => handleSelectChannel(isSelectedChannel ? '' : c.channel)}
                          title={`Click to filter by ${c.channel}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                            <span style={{ fontWeight: isSelectedChannel ? 700 : 600, color: isSelectedChannel ? 'var(--brand)' : '#1e293b' }}>
                              {c.channel.replaceAll('_', ' ').toUpperCase()} {isSelectedChannel && '(Active Filter)'}
                            </span>
                            <span>
                              <strong>BDT {money(amt)}</strong> <span className="muted" style={{ fontSize: '11px' }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: isSelectedChannel ? 'var(--brand)' : 'linear-gradient(90deg, #059669, #10b981)',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="panel empty" style={{ minHeight: '100px', display: 'grid', placeItems: 'center' }}>
                    No channel revenue data in this period.
                  </div>
                )}
              </div>

              {/* Sales vs Returns Retention Ratio (Only in All mode) */}
              {transactionType === 'all' && (
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                    <span>Sales Retention vs. Returns</span>
                    <span style={{ color: Number(returnRatePercent) > 5 ? '#dc2626' : '#059669' }}>
                      {returnRatePercent}% Return Claims
                    </span>
                  </div>
                  <div style={{ display: 'flex', height: '10px', width: '100%', borderRadius: '5px', overflow: 'hidden', background: '#e2e8f0' }}>
                    <div style={{ width: `${Math.max(0, 100 - Number(returnRatePercent))}%`, background: '#059669' }} title="Retained Gross Invoices" />
                    <div style={{ width: `${Math.min(100, Number(returnRatePercent))}%`, background: '#ef4444' }} title="Proposed Return Claims" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                    <span>Retained: BDT {money(netEstimatedRevenue)}</span>
                    <span>Returns: BDT {money(returnCredit)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Return Channel Distribution */
            <div className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                      Return Claims by Channel
                    </h3>
                    <small className="muted">Channels experiencing return requests and claimed credits</small>
                  </div>
                  <span className="badge badge-amber">{returnChannelList.length} Channels</span>
                </div>

                {returnChannelList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {returnChannelList.map(c => {
                      const amt = Number(c.proposed_credit || 0);
                      const pct = totalReturnChannelAmount > 0 ? ((amt / totalReturnChannelAmount) * 100).toFixed(1) : '0';
                      const isSelectedChannel = applied.channel === c.channel;

                      return (
                        <div
                          key={c.channel}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            background: isSelectedChannel ? '#fffbeb' : 'transparent',
                          }}
                          onClick={() => handleSelectChannel(isSelectedChannel ? '' : c.channel)}
                          title={`Click to filter by ${c.channel}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                            <span style={{ fontWeight: isSelectedChannel ? 700 : 600, color: isSelectedChannel ? '#b45309' : '#1e293b' }}>
                              {c.channel.replaceAll('_', ' ').toUpperCase()} ({c.return_count} claims, {c.returned_copies} pcs)
                            </span>
                            <span>
                              <strong style={{ color: '#b45309' }}>BDT {money(amt)}</strong> <span className="muted" style={{ fontSize: '11px' }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="panel empty" style={{ minHeight: '100px', display: 'grid', placeItems: 'center' }}>
                    No return claims by channel in this period.
                  </div>
                )}
              </div>

              <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fde68a', fontSize: '12px', color: '#92400e' }}>
                💡 <strong>Return Audit:</strong> Claims are verified against physical goods receipt before credit notes and general ledger reversals are generated.
              </div>
            </div>
          )}
        </section>
      )}

      {/* Caveat Alert */}
      {report && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 16px', fontSize: '12.5px', color: '#92400e', lineHeight: 1.5 }}>
          <strong>Statutory Revenue Isolation Caveat: </strong>{report.caveat}
        </div>
      )}

      {/* Tabbed Detailed Registers */}
      {report && (
        <section className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {[
                ...(transactionType === 'all' ? [{ id: 'trends', label: 'Overview & Channels' }] : []),
                ...(transactionType !== 'returns' ? [{ id: 'invoices', label: `Posted Invoices (${report.pagination.totalInvoices})` }] : []),
                ...(transactionType !== 'sales' ? [{ id: 'returns', label: `Posted Returns (${report.pagination.totalReturns})` }] : []),
                { id: 'definitions', label: 'Metric Definitions' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    border: 'none',
                    background: activeTab === tab.id ? '#eff6ff' : 'transparent',
                    color: activeTab === tab.id ? 'var(--brand)' : '#64748b',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveTab(tab.id as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'invoices' && (
              <span className="badge badge-blue">Page {page + 1} of {Math.max(1, Math.ceil(report.pagination.totalInvoices / 20))}</span>
            )}
            {activeTab === 'returns' && (
              <span className="badge badge-amber">Page {page + 1} of {Math.max(1, Math.ceil(report.pagination.totalReturns / 20))}</span>
            )}
          </div>

          {/* Tab 1: Overview Channels Detail */}
          {activeTab === 'trends' && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Channel Name</th>
                    <th>Invoices Count</th>
                    <th>Gross Invoiced (Ex-Tax)</th>
                    <th>Revenue Share</th>
                    <th style={{ textAlign: 'right' }}>Filter Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {channelList.length ? (
                    channelList.map(row => {
                      const pct = totalChannelAmount > 0 ? ((Number(row.ex_tax_amount) / totalChannelAmount) * 100).toFixed(1) : '0';
                      const isSelected = applied.channel === row.channel;
                      return (
                        <tr key={row.channel} style={{ background: isSelected ? '#eff6ff' : undefined }}>
                          <td>
                            <strong>{row.channel.replaceAll('_', ' ').toUpperCase()}</strong>
                            {isSelected && <span className="badge badge-blue" style={{ marginLeft: '6px' }}>Active</span>}
                          </td>
                          <td>{row.invoices}</td>
                          <td><strong>BDT {money(row.ex_tax_amount)}</strong></td>
                          <td><span className="badge badge-green">{pct}%</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn"
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                              onClick={() => handleSelectChannel(isSelected ? '' : row.channel)}
                            >
                              {isSelected ? 'Clear Filter' : 'Filter Channel ➔'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty">No channel activity matching the active filter criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Invoices Register */}
          {activeTab === 'invoices' && (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice Date</th>
                      <th>Invoice #</th>
                      <th>Customer</th>
                      <th>Sales Channel</th>
                      <th>Ex-Tax (BDT)</th>
                      <th>Tax (BDT)</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.invoices.length ? (
                      report.invoices.map(row => (
                        <tr key={row.id}>
                          <td>{day(row.invoice_date)}</td>
                          <td><strong>{row.invoice_number}</strong></td>
                          <td>{row.customer_name}</td>
                          <td><span className="badge badge-blue">{row.sales_channel}</span></td>
                          <td><strong>BDT {money(row.ex_tax_amount)}</strong></td>
                          <td className="muted">BDT {money(row.tax_amount)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <Link className="btn" href={`/sales-distribution/sales-invoice-list?invoice=${row.invoice_number}`} style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                              View In Register ➔
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="empty">No posted invoices match the active filter criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span className="muted" style={{ fontSize: '12px' }}>
                  Showing {page * 20 + 1}–{Math.min(report.pagination.totalInvoices, (page + 1) * 20)} of {report.pagination.totalInvoices}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={(page + 1) * 20 >= report.pagination.totalInvoices}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {/* Tab 3: Returns Register */}
          {activeTab === 'returns' && (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Return Date</th>
                      <th>Return #</th>
                      <th>Original Invoice</th>
                      <th>Channel</th>
                      <th>Reason</th>
                      <th>Returned Copies</th>
                      <th>Proposed Credit (BDT)</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.returns.length ? (
                      report.returns.map(row => (
                        <tr key={row.id}>
                          <td>{day(row.return_date)}</td>
                          <td><strong>{row.return_number}</strong></td>
                          <td>{row.invoice_number}</td>
                          <td><span className="badge badge-amber">{row.sales_channel}</span></td>
                          <td style={{ fontSize: '12px', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.reason || 'Customer Return'}
                          </td>
                          <td><strong>{row.quantity}</strong></td>
                          <td style={{ color: '#b45309' }}><strong>BDT {money(row.proposed_credit)}</strong></td>
                          <td style={{ textAlign: 'right' }}>
                            <Link className="btn" href={`/returns-claims/return-request-list?return=${row.return_number}`} style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                              View Return ➔
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty">No posted return claims match the active filter criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span className="muted" style={{ fontSize: '12px' }}>
                  Showing {page * 20 + 1}–{Math.min(report.pagination.totalReturns, (page + 1) * 20)} of {report.pagination.totalReturns}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={(page + 1) * 20 >= report.pagination.totalReturns}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {/* Tab 4: Statutory Metric Definitions */}
          {activeTab === 'definitions' && (
            <div style={{ display: 'grid', gap: '12px' }}>
              {report.definitions.map(row => (
                <div key={row.code} style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{row.label}</strong>
                    <code style={{ fontSize: '11px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>{row.code}</code>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '4px' }}>
                    <strong>Formula: </strong><code>{row.formula}</code> · <strong>Grain: </strong>{row.grain} · <strong>Currency: </strong>{row.currency}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {row.note}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Footer Notes */}
      <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '12px', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span>
          Live query against <code>sales_invoices</code> and <code>sales_returns</code> tables with strict status and currency boundaries.
        </span>
        <Link href="/reports-analytics/report-center" style={{ fontWeight: 600, color: 'var(--brand)' }}>
          Back to Report Center ➔
        </Link>
      </div>
    </div>
  );
}
