"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Award,
  CheckCircle2,
  Clock,
  DollarSign,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Package,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

export function SupplierPerformanceScreen({ screen }: { screen: Screen }) {
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadReport(id = supplierId, start = from, end = to) {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (id) query.set('supplierId', id);
      if (start) query.set('from', start);
      if (end) query.set('to', end);

      const res = await api<{ data: Row }>(`/procurement/performance?${query}`);
      setReport(res.data);
    } catch (err: any) {
      setError(err?.message || 'Could not load supplier performance scorecard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([
      api<{ data: { data: Row[] } }>('/procurement/suppliers?limit=100'),
      api<{ data: Row }>('/procurement/performance'),
    ])
      .then(([suppliersRes, reportRes]) => {
        setSuppliers(suppliersRes.data.data || []);
        setReport(reportRes.data);
      })
      .catch((err: any) => setError(err?.message || 'Could not load data'))
      .finally(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    if (!report?.data?.length) {
      return { totalSpend: 0, totalOrders: 0, totalReceipts: 0, avgOnTime: 0 };
    }
    const data: Row[] = report.data;
    const totalSpend = data.reduce((sum, r) => sum + Number(r.approvedPoValue || 0), 0);
    const totalOrders = data.reduce((sum, r) => sum + Number(r.orderCount || 0), 0);
    const totalReceipts = data.reduce((sum, r) => sum + Number(r.receiptCount || 0), 0);
    const validOnTime = data.filter(r => r.onTimeRate != null);
    const avgOnTime = validOnTime.length
      ? Math.round(validOnTime.reduce((sum, r) => sum + Number(r.onTimeRate), 0) / validOnTime.length)
      : 0;

    return { totalSpend, totalOrders, totalReceipts, avgOnTime };
  }, [report]);

  const maxPoValue = Math.max(1, ...(report?.data?.map((r: Row) => Number(r.approvedPoValue || 0)) ?? []));

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Supplier scorecard: track delivery punctuality, quality acceptance rate, and spend distribution.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void loadReport()} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Scorecard</span>
          </button>
          <Link className="btn btn-primary" href="/suppliers/supplier-directory">
            <Building2 size={15} />
            <span>Supplier Directory</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Date Range & Filter Toolbar */}
      <div
        className="panel"
        style={{
          padding: '14px 18px',
          marginBottom: 20,
          background: '#fff',
          borderRadius: 10,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="input"
            value={supplierId}
            onChange={e => setSupplierId(e.target.value)}
            style={{ width: 220, height: 38 }}
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.supplier_code} · {s.name}
              </option>
            ))}
          </select>

          <input
            className="input"
            type="date"
            placeholder="From Date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            style={{ width: 145, height: 38 }}
          />
          <span style={{ color: '#94a3b8' }}>to</span>
          <input
            className="input"
            type="date"
            placeholder="To Date"
            value={to}
            onChange={e => setTo(e.target.value)}
            style={{ width: 145, height: 38 }}
          />

          <button
            className="btn btn-primary"
            onClick={() => void loadReport()}
            disabled={loading}
            style={{ height: 38 }}
          >
            Apply Filters
          </button>
        </div>

        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          {report?.data?.length || 0} active suppliers evaluated
        </span>
      </div>

      {/* 4 Financial & Performance KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #3b82f6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Total Evaluated Spend
            </span>
            <DollarSign size={18} color="#3b82f6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Across {kpis.totalOrders} approved orders
          </span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #10b981',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Avg On-Time Delivery
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.avgOnTime}%
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Deliveries met promised due dates</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #8b5cf6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Goods Receipts
            </span>
            <Package size={18} color="#8b5cf6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.totalReceipts}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Delivered shipments inspected</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #f59e0b',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Active Vendors
            </span>
            <Award size={18} color="#f59e0b" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {report?.data?.length || 0}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Vendors with delivery history</span>
        </div>
      </div>

      {/* Spend Distribution Progress Bars */}
      {report?.data?.length ? (
        <div className="panel" style={{ padding: 20, background: '#fff', borderRadius: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              Purchasing Volume by Supplier
            </h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>Spend Share Comparison</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {report.data.map((r: Row, idx: number) => {
              const val = Number(r.approvedPoValue || 0);
              const pct = Math.round((val / maxPoValue) * 100);
              return (
                <div key={r.supplierId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {r.supplierName} ({r.supplierCode})
                    </span>
                    <span style={{ color: '#64748b' }}>
                      <strong>BDT {val.toLocaleString()}</strong> ({r.orderCount} orders)
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: idx === 0 ? '#2563eb' : idx === 1 ? '#059669' : idx === 2 ? '#8b5cf6' : '#64748b',
                        borderRadius: 4,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Main Supplier Scorecard Table */}
      <div className="panel table-wrap" style={{ background: '#fff', borderRadius: 10 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Supplier Code &amp; Name</th>
              <th>Approved Orders</th>
              <th>Total Spend (BDT)</th>
              <th>Receipts (GRN)</th>
              <th>On-Time vs Late</th>
              <th>Punctuality Rate</th>
              <th>Quality Acceptance (UOM)</th>
              <th style={{ textAlign: 'right' }}>Ledger</th>
            </tr>
          </thead>
          <tbody>
            {report?.data?.length ? (
              report.data.map((row: Row) => {
                const rate = row.onTimeRate;
                const rateColor =
                  rate == null
                    ? '#64748b'
                    : rate >= 90
                    ? '#059669'
                    : rate >= 75
                    ? '#d97706'
                    : '#dc2626';

                return (
                  <tr key={row.supplierId}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.supplierName}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>
                        <code>{row.supplierCode}</code>
                      </div>
                    </td>
                    <td>
                      <strong>{row.orderCount} orders</strong>
                    </td>
                    <td>
                      <strong>
                        BDT {Number(row.approvedPoValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td>{row.receiptCount} receipts</td>
                    <td>
                      <span style={{ color: '#059669', fontWeight: 600 }}>{row.onTimeReceiptCount} on time</span>
                      {Number(row.lateReceiptCount) > 0 && (
                        <span style={{ color: '#dc2626', marginLeft: 4 }}>({row.lateReceiptCount} late)</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: rate == null ? '#f1f5f9' : rate >= 80 ? '#ecfdf5' : '#fffbeb',
                          color: rateColor,
                        }}
                      >
                        {rate == null ? 'No Data' : `${rate}%`}
                      </span>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      {(row.units || []).length ? (
                        row.units.map((u: Row, i: number) => (
                          <div key={i} style={{ fontSize: 11.5, color: '#334155' }}>
                            <strong>{u.uom}:</strong> {u.accepted} accepted, {u.rejected} rejected
                            {Number(u.rejectionRate) > 0 && (
                              <span style={{ color: '#dc2626', marginLeft: 4 }}>({u.rejectionRate}% rej)</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        className="btn btn-sm btn-primary"
                        href={`/suppliers/supplier-profile-and-ledger?supplier=${row.supplierId}`}
                        style={{ height: 30, fontSize: 12 }}
                      >
                        Open Ledger
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="empty" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  {loading ? 'Evaluating supplier history...' : 'No supplier performance records in this range.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
