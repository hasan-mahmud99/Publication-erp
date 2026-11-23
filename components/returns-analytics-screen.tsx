"use client";

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Package,
  Calendar,
  Layers,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  Filter,
  RefreshCw,
  FileText,
  Warehouse,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type AnalyticsData = {
  fromDate: string;
  toDate: string;
  statuses: Array<{ status: string; requests: number; copies: number; proposed_credit: string }>;
  monthly: Array<{ month: string; status: string; requests: number }>;
  conditions: Array<{ condition_code: string; status: string; copies: string; receipts: number }>;
  channels: Array<{ sales_channel: string; requests: number; copies: string }>;
  reasons: Array<{ reason_text: string; count: number; copies: number; credit_amount: string }>;
  topTitles: Array<{ book_title: string; copies: number; refund_amount: string }>;
  creditNotes: {
    total_credit_notes: number;
    posted_credit_amount: string | number;
    draft_credit_amount: string | number;
  };
  settlements: {
    total_settlements: number;
    account_credit_amount: string | number;
    refund_amount: string | number;
    replacement_amount: string | number;
  };
  financialPostingAvailable: boolean;
};

const today = new Date().toISOString().slice(0, 10);
const startOfYear = `${today.slice(0, 4)}-01-01`;

export function ReturnsAnalyticsScreen({ screen }: { screen: Screen }) {
  const [fromDate, setFromDate] = useState(startOfYear);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(from = fromDate, to = toDate) {
    if (from > to) {
      setError('Start date cannot be after end date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api<{ data: AnalyticsData }>(`/returns/analytics?fromDate=${from}&toDate=${to}`);
      setData(res.data);
    } catch (cause: any) {
      setError(cause instanceof Error ? cause.message : 'Could not load return analytics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalRequests = data?.statuses.reduce((sum, row) => sum + Number(row.requests), 0) ?? 0;
  const totalCopies = data?.statuses.reduce((sum, row) => sum + Number(row.copies), 0) ?? 0;
  const totalProposedCredit = data?.statuses.reduce((sum, row) => sum + Number(row.proposed_credit), 0) ?? 0;

  const maxReasonCopies = Math.max(1, ...(data?.reasons?.map(r => Number(r.copies)) ?? []));
  const maxTitleCopies = Math.max(1, ...(data?.topTitles?.map(t => Number(t.copies)) ?? []));

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Executive insights into return volumes, physical book condition grading, root-cause defect analysis, and credit notes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void load()} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Date Range Toolbar */}
      <div
        className="panel"
        style={{
          padding: '14px 18px',
          marginBottom: 20,
          background: '#fff',
          borderRadius: 10,
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={15} color="#64748b" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Date Range:</span>
          </div>

          <input
            className="input"
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ width: 145, height: 36, fontSize: 13 }}
          />
          <span style={{ color: '#94a3b8' }}>to</span>
          <input
            className="input"
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ width: 145, height: 36, fontSize: 13 }}
          />

          <button
            className="btn btn-primary"
            onClick={() => void load(fromDate, toDate)}
            disabled={loading}
            style={{ height: 36, fontSize: 13 }}
          >
            Apply Range
          </button>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm"
            style={{ height: 30, fontSize: 11.5 }}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 30);
              const past = d.toISOString().slice(0, 10);
              setFromDate(past);
              setToDate(today);
              void load(past, today);
            }}
          >
            Last 30 Days
          </button>
          <button
            className="btn btn-sm"
            style={{ height: 30, fontSize: 11.5 }}
            onClick={() => {
              setFromDate(startOfYear);
              setToDate(today);
              void load(startOfYear, today);
            }}
          >
            Year to Date
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
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
              Return Requests
            </span>
            <RotateCcw size={18} color="#3b82f6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {totalRequests}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {totalCopies.toLocaleString()} copies requested
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
              Posted Credit Notes
            </span>
            <DollarSign size={18} color="#10b981" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {Number(data?.creditNotes?.posted_credit_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {data?.creditNotes?.total_credit_notes || 0} Mushak-6.7 notes issued
          </span>
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
              Customer Settlements
            </span>
            <FileText size={18} color="#8b5cf6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {Number(
              Number(data?.settlements?.account_credit_amount || 0) +
                Number(data?.settlements?.refund_amount || 0) +
                Number(data?.settlements?.replacement_amount || 0)
            ).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {data?.settlements?.total_settlements || 0} settlements processed
          </span>
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
              Physical Inspections
            </span>
            <Warehouse size={18} color="#f59e0b" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {data?.conditions?.reduce((sum, c) => sum + Number(c.copies), 0).toLocaleString() ?? 0}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Copies graded by warehouse QC</span>
        </div>
      </div>

      {/* Grid: Root-Cause Reasons & Top Returned Titles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Reasons Breakdown */}
        <div className="panel" style={{ padding: 20, background: '#fff', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              Returns by Reason (Root Cause)
            </h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>Volume & Value</span>
          </div>

          {data?.reasons?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.reasons.map((r, i) => {
                const pct = Math.round((Number(r.copies) / maxReasonCopies) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{r.reason_text}</span>
                      <span style={{ color: '#64748b' }}>
                        <strong>{r.copies} copies</strong> ({r.count} requests) · BDT {Number(r.credit_amount).toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        background: '#f1f5f9',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background:
                            i === 0
                              ? '#ef4444'
                              : i === 1
                              ? '#f59e0b'
                              : i === 2
                              ? '#3b82f6'
                              : '#10b981',
                          borderRadius: 4,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', textAlign: 'center', margin: '30px 0' }}>
              No reason breakdown recorded for this range.
            </p>
          )}
        </div>

        {/* Top Returned Titles */}
        <div className="panel" style={{ padding: 20, background: '#fff', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              Top Returned Book Titles
            </h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>Highest copy returns</span>
          </div>

          {data?.topTitles?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.topTitles.map((t, i) => {
                const pct = Math.round((Number(t.copies) / maxTitleCopies) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BookOpen size={14} color="#6366f1" />
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{t.book_title}</span>
                      </div>
                      <span style={{ color: '#64748b' }}>
                        <strong style={{ color: '#dc2626' }}>{t.copies} copies</strong> · BDT {Number(t.refund_amount).toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        background: '#f1f5f9',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: '#6366f1',
                          borderRadius: 4,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', textAlign: 'center', margin: '30px 0' }}>
              No title return data in this period.
            </p>
          )}
        </div>
      </div>

      {/* Grid: Condition QC Grading & Settlement Distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Physical QC Grading */}
        <div className="panel" style={{ padding: 20, background: '#fff', borderRadius: 10 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            Warehouse QC Inspection by Condition
          </h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Condition Grade</th>
                  <th>Receipt Status</th>
                  <th>Batches</th>
                  <th>Copies</th>
                </tr>
              </thead>
              <tbody>
                {data?.conditions?.length ? (
                  data.conditions.map((c, i) => (
                    <tr key={i}>
                      <td>
                        <strong
                          style={{
                            color:
                              c.condition_code === 'GRADE_A'
                                ? '#15803d'
                                : c.condition_code === 'GRADE_C'
                                ? '#b91c1c'
                                : '#334155',
                          }}
                        >
                          {c.condition_code === 'GRADE_A'
                            ? 'Grade A (Sellable Restock)'
                            : c.condition_code === 'GRADE_C'
                            ? 'Grade C (Damaged / Quarantine)'
                            : c.condition_code}
                        </strong>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: 11,
                            fontWeight: 700,
                            background: c.status === 'approved' ? '#ecfdf5' : '#fffbeb',
                            color: c.status === 'approved' ? '#065f46' : '#92400e',
                          }}
                        >
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{c.receipts} receipts</td>
                      <td>
                        <strong>{Number(c.copies).toLocaleString()} units</strong>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="empty" style={{ textAlign: 'center', color: '#64748b' }}>
                      No physical inspection receipts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settlement Type Breakdown */}
        <div className="panel" style={{ padding: 20, background: '#fff', borderRadius: 10 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            Financial Settlement Channels
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <strong style={{ fontSize: 14, color: '#1e293b' }}>Customer Ledger Credit</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>Applied against future distributor invoices</div>
              </div>
              <strong style={{ fontSize: 16, color: '#0369a1' }}>
                BDT {Number(data?.settlements?.account_credit_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <strong style={{ fontSize: 14, color: '#1e293b' }}>Bank & Cash Refunds</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>Direct funds returned to customer</div>
              </div>
              <strong style={{ fontSize: 16, color: '#15803d' }}>
                BDT {Number(data?.settlements?.refund_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <strong style={{ fontSize: 14, color: '#1e293b' }}>Zero-Value Replacement Orders</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>Fresh copies dispatched at zero bill</div>
              </div>
              <strong style={{ fontSize: 16, color: '#8b5cf6' }}>
                BDT {Number(data?.settlements?.replacement_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
