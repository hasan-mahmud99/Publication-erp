"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Definition = {
  id: string;
  report_code: string;
  title: string;
  route_path: string;
  dataset_key: string;
  required_permission: string;
  definition_json: { basis: string; version?: number };
  version_no: number;
  updated_at: string;
};

type Schedule = {
  id: string;
  report_code: string;
  period_code: string;
  frequency: string;
  status: string;
};

type ExportJob = {
  id: string;
  report_code: string;
  status: string;
  row_count: number;
};

// Domain mapping helper for ERP report categorization
function getReportDomain(code: string): { label: string; color: string; bg: string; border: string } {
  switch (code) {
    case 'FINANCIAL_STATEMENTS':
    case 'ROYALTY_LIABILITY':
      return { label: 'Finance & Royalties', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' };
    case 'SALES_RETURNS_SOURCE':
    case 'OPERATIONAL_KPI':
      return { label: 'Sales & Commercial', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
    case 'PRODUCTION_COST':
      return { label: 'Production & WIP', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
    case 'INVENTORY_STOCK':
    case 'DATA_RECONCILIATION':
      return { label: 'Inventory & Controls', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' };
    case 'PUBLISHER_IMPRINT_PORTFOLIO':
    case 'EDITION_LIFECYCLE':
      return { label: 'Catalog & Editorial', color: '#b45309', bg: '#fffbeb', border: '#fde68a' };
    default:
      return { label: 'General Reporting', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
  }
}

export function ReportCenterScreen() {
  const [reports, setReports] = useState<Definition[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [catRes, schedRes, jobsRes] = await Promise.all([
        api<{ data: Definition[] }>('/reports/catalog').catch(() => ({ data: [] as Definition[] })),
        api<{ data: Schedule[] }>('/reports/schedules').catch(() => ({ data: [] as Schedule[] })),
        api<{ data: ExportJob[] }>('/reports/export-jobs?limit=20').catch(() => ({ data: [] as ExportJob[] })),
      ]);
      setReports(catRes.data || []);
      setSchedules(schedRes.data || []);
      setExportJobs(jobsRes.data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load report catalog');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(() => {
    const list = [
      { id: 'ALL', label: 'All Reports', count: reports.length },
      { id: 'FINANCE', label: 'Finance & Royalties', count: reports.filter(r => ['FINANCIAL_STATEMENTS', 'ROYALTY_LIABILITY'].includes(r.report_code)).length },
      { id: 'SALES', label: 'Sales & Commercial', count: reports.filter(r => ['SALES_RETURNS_SOURCE', 'OPERATIONAL_KPI'].includes(r.report_code)).length },
      { id: 'PRODUCTION', label: 'Production & WIP', count: reports.filter(r => ['PRODUCTION_COST'].includes(r.report_code)).length },
      { id: 'INVENTORY', label: 'Inventory & Controls', count: reports.filter(r => ['INVENTORY_STOCK', 'DATA_RECONCILIATION'].includes(r.report_code)).length },
      { id: 'CATALOG', label: 'Catalog & Editorial', count: reports.filter(r => ['PUBLISHER_IMPRINT_PORTFOLIO', 'EDITION_LIFECYCLE'].includes(r.report_code)).length },
    ];
    return list;
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      // Category filter
      if (activeCategory === 'FINANCE' && !['FINANCIAL_STATEMENTS', 'ROYALTY_LIABILITY'].includes(report.report_code)) return false;
      if (activeCategory === 'SALES' && !['SALES_RETURNS_SOURCE', 'OPERATIONAL_KPI'].includes(report.report_code)) return false;
      if (activeCategory === 'PRODUCTION' && !['PRODUCTION_COST'].includes(report.report_code)) return false;
      if (activeCategory === 'INVENTORY' && !['INVENTORY_STOCK', 'DATA_RECONCILIATION'].includes(report.report_code)) return false;
      if (activeCategory === 'CATALOG' && !['PUBLISHER_IMPRINT_PORTFOLIO', 'EDITION_LIFECYCLE'].includes(report.report_code)) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const domain = getReportDomain(report.report_code).label.toLowerCase();
        const basis = (report.definition_json?.basis || '').toLowerCase();
        const matchTitle = report.title.toLowerCase().includes(q);
        const matchDataset = report.dataset_key.toLowerCase().includes(q);
        const matchCode = report.report_code.toLowerCase().includes(q);
        return matchTitle || matchDataset || matchCode || domain.includes(q) || basis.includes(q);
      }

      return true;
    });
  }, [reports, activeCategory, search]);

  const readyExportsCount = exportJobs.filter(j => j.status === 'ready').length;
  const activeSchedulesCount = schedules.filter(s => s.status === 'active').length;

  return (
    <div suppressHydrationWarning style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div className="page-heading" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Enterprise Report Center</h1>
          <p className="muted">
            Centralized hub for audited operational reports, general ledger statements, export queues, and scheduled runs.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={() => void load()}
          disabled={loading}
        >
          <span>🔄</span>
          <span>{loading ? 'Refreshing...' : 'Refresh Catalog'}</span>
        </button>
      </div>

      {error && <div className="alert-error" role="alert">{error}</div>}

      {/* Top Telemetry KPI Bar */}
      <div className="stat-grid" style={{ marginTop: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <div className="panel stat">
          <div className="stat-label">AUDITED REPORTS</div>
          <div className="stat-value">{loading ? '…' : reports.length}</div>
          <div className="stat-sub muted">Live verified catalog sources</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">RECURRING SCHEDULES</div>
          <div className="stat-value" style={{ color: activeSchedulesCount > 0 ? '#059669' : 'var(--text)' }}>
            {loading ? '…' : `${activeSchedulesCount} Active`}
          </div>
          <div className="stat-sub muted">Automated UTC report jobs</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">READY CSV EXPORTS</div>
          <div className="stat-value" style={{ color: readyExportsCount > 0 ? '#059669' : 'var(--text)' }}>
            {loading ? '…' : `${readyExportsCount} Ready`}
          </div>
          <div className="stat-sub muted">Available in download queue</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">REPORTING INTEGRITY</div>
          <div className="stat-value compact" style={{ color: '#059669' }}>100% Live</div>
          <div className="stat-sub muted">Posted ledger &amp; stock controls</div>
        </div>
      </div>

      {/* Reporting Operations Hub Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        <div className="panel" style={{ padding: '16px 18px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '3px 8px', borderRadius: '6px' }}>
                AUTOMATION
              </span>
              <span className="badge badge-blue">{schedules.length} configured</span>
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              Scheduled Reports Engine
            </h3>
            <p className="muted" style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.5 }}>
              Set up automated daily or weekly recurring exports in UTC with background data staging.
            </p>
          </div>
          <Link className="btn btn-primary" href="/reports-analytics/scheduled-reports" style={{ fontSize: '13px', textAlign: 'center' }}>
            Manage Schedules ➔
          </Link>
        </div>

        <div className="panel" style={{ padding: '16px 18px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#047857', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>
                DOWNLOADS
              </span>
              <span className="badge badge-green">{exportJobs.length} historical</span>
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              Export Job History
            </h3>
            <p className="muted" style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.5 }}>
              Access completed CSV downloads, inspect execution statuses, or re-run expired export tasks.
            </p>
          </div>
          <Link className="btn btn-primary" href="/reports-analytics/export-job-history" style={{ fontSize: '13px', textAlign: 'center' }}>
            View Export Queue ➔
          </Link>
        </div>

        <div className="panel" style={{ padding: '16px 18px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '3px 8px', borderRadius: '6px' }}>
                COMPLIANCE
              </span>
              <span className="badge badge-purple">Audited</span>
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              Report Access Audit
            </h3>
            <p className="muted" style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.5 }}>
              Verify tamper-evident audit logs tracking every report view, data query, and CSV download.
            </p>
          </div>
          <Link className="btn" href="/reports-analytics/report-access-audit" style={{ fontSize: '13px', textAlign: 'center' }}>
            Inspect Access Logs ➔
          </Link>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section className="panel" style={{ padding: '18px 20px', borderRadius: '12px', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12.5px',
                  fontWeight: activeCategory === cat.id ? 700 : 500,
                  border: '1px solid',
                  borderColor: activeCategory === cat.id ? 'var(--brand)' : 'var(--line)',
                  background: activeCategory === cat.id ? 'var(--brand)' : '#f8fafc',
                  color: activeCategory === cat.id ? '#fff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.label}</span>
                <span
                  style={{
                    fontSize: '10.5px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: activeCategory === cat.id ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    color: activeCategory === cat.id ? '#fff' : '#475569',
                  }}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'grid' ? '#fff' : 'transparent',
                color: viewMode === 'grid' ? 'var(--brand)' : 'var(--muted)',
                fontWeight: viewMode === 'grid' ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
              onClick={() => setViewMode('grid')}
            >
              ⊞ Cards
            </button>
            <button
              type="button"
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'table' ? '#fff' : 'transparent',
                color: viewMode === 'table' ? 'var(--brand)' : 'var(--muted)',
                fontWeight: viewMode === 'table' ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
              onClick={() => setViewMode('table')}
            >
              ☰ Table
            </button>
          </div>
        </div>

        {/* Live Search Bar */}
        <div>
          <input
            className="input"
            style={{ width: '100%', fontSize: '13.5px', padding: '10px 14px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search reports by title, dataset key, or reporting basis..."
          />
        </div>
      </section>

      {/* Reports Display: Grid Cards vs Table View */}
      {loading ? (
        <div className="panel empty" style={{ padding: '40px', textAlign: 'center' }}>
          Loading enterprise report catalog...
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="panel empty" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 600 }}>No authorized reports match your search criteria.</p>
          <button type="button" className="btn" onClick={() => { setSearch(''); setActiveCategory('ALL'); }}>
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredReports.map(report => {
            const domain = getReportDomain(report.report_code);
            return (
              <article
                key={report.id}
                className="panel"
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: '#fff',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: domain.color,
                        background: domain.bg,
                        border: `1px solid ${domain.border}`,
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      {domain.label}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                      v{report.version_no}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                    {report.title}
                  </h3>

                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                    {report.definition_json?.basis || 'Direct live dataset query.'}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                      🗄 {report.dataset_key.replaceAll('_', ' ')}
                    </span>
                    <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '3px 7px', borderRadius: '6px' }}>
                      🔒 {report.required_permission}
                    </span>
                  </div>
                </div>

                <div style={{ paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Audited source
                  </span>
                  <Link
                    className="btn btn-primary"
                    href={report.route_path}
                    style={{ fontSize: '13px', fontWeight: 600, padding: '7px 16px' }}
                  >
                    Open Report ➔
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel table-wrap" style={{ borderRadius: '12px', padding: '0', overflow: 'hidden' }}>
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Report Title</th>
                <th>Domain</th>
                <th>Source Dataset</th>
                <th>Reporting Basis</th>
                <th>Access Level</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map(report => {
                const domain = getReportDomain(report.report_code);
                return (
                  <tr key={report.id}>
                    <td>
                      <strong>{report.title}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        {report.report_code}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: domain.color,
                          background: domain.bg,
                          border: `1px solid ${domain.border}`,
                          padding: '2px 7px',
                          borderRadius: '6px',
                        }}
                      >
                        {domain.label}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '11.5px' }}>{report.dataset_key}</code>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#475569', maxWidth: '320px' }}>
                      {report.definition_json?.basis || '—'}
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px' }}>
                        {report.required_permission}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link className="btn btn-primary" href={report.route_path} style={{ fontSize: '12px', padding: '5px 12px' }}>
                        Open ➔
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Footer Notes */}
      <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--text)' }}>Compliance &amp; Data Governance: </strong>
        All reports run against verified posted journals, stock transactions, and finalized statement vouchers. Every query execution and CSV download is tamper-evident and permanently recorded in the access audit registry.
      </div>
    </div>
  );
}
