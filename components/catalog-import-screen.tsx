"use client";

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { api, apiFile } from '@/lib/api';
import { BulkImportWizard } from './bulk-import-wizard';
import type { Screen } from '@/lib/screens';

type Job = {
  id: string;
  entityKey: string;
  fileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  createdAt: string;
  uploadedBy: string;
};

type Row = {
  rowNumber: number;
  status: string;
  errors: string[];
  mapped: Record<string, unknown>;
  importedRecordId: string | null;
};

type Detail = Job & {
  rows: Row[];
  confirmedAt: string | null;
  approvalComment: string | null;
};

const day = (value: string) => String(value).slice(0, 10);

export function CatalogImportScreen({ screen }: { screen: Screen }) {
  const isHistory = screen.title === 'Import Job History';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailRowTab, setDetailRowTab] = useState<'all' | 'failed' | 'valid'>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [templateType, setTemplateType] = useState('books-editions');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    setLoading(true);
    try {
      const result = await api<{ data: Job[]; meta: { total: number } }>(
        `/catalog/import-jobs?limit=25&offset=${page * 25}`
      );
      setJobs(result.data);
      setTotal(result.meta.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load import history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, screen.id]);

  async function openDetail(id: string) {
    setError('');
    setDetailLoading(true);
    try {
      const result = await api<{ data: Detail }>(`/bulk-imports/${id}`);
      setDetail(result.data);
      setDetailRowTab('all');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load import job details');
    } finally {
      setDetailLoading(false);
    }
  }

  function downloadTemplate(type = templateType) {
    const header =
      type === 'catalog-categories'
        ? 'code,name,parentCode,description,sortOrder,status\r\n'
        : 'title,editionNumber,format,isbn\r\n';
    const blob = new Blob([header], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `catalog-${type}-template.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Downloaded ${type === 'catalog-categories' ? 'Categories' : 'Books & Editions'} CSV template.`);
  }

  async function downloadErrors(id: string) {
    try {
      const blob = await apiFile(`/bulk-imports/${id}/errors.csv`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `import-${id.slice(0, 8)}-errors.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Error report CSV downloaded successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error report download failed');
    }
  }

  // Aggregate KPI stats
  const totalJobs = total;
  const confirmedJobs = jobs.filter(j => ['confirmed', 'imported'].includes(j.status)).length;
  const jobsWithErrors = jobs.filter(j => j.invalidRows > 0 || j.duplicateRows > 0).length;
  const totalIngestedRows = jobs.reduce((acc, j) => acc + (Number(j.validRows) || 0), 0);

  // Filtered rows in detail view
  const filteredDetailRows = useMemo(() => {
    if (!detail) return [];
    if (detailRowTab === 'failed') {
      return detail.rows.filter(r => r.status === 'invalid' || r.status === 'duplicate');
    }
    if (detailRowTab === 'valid') {
      return detail.rows.filter(r => r.status === 'valid' || r.status === 'imported');
    }
    return detail.rows;
  }, [detail, detailRowTab]);

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            {isHistory
              ? 'Audit log and diagnostic inspection of bulk catalog uploads, row validation results, and ingestion errors.'
              : 'Stage, validate, and preview multi-row catalog spreadsheets before committing to database.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowWizard(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>➕</span>
            <span>Start Bulk Import</span>
          </button>
          <button className="btn" onClick={() => void load()}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '16px' }}>
          {notice}
        </div>
      )}

      {/* KPI Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="panel" style={{ padding: '16px 20px', borderLeft: '4px solid #4f46e5' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            📦 Total Ingest Jobs
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalJobs}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Batches logged across catalog
          </div>
        </div>

        <div className="panel" style={{ padding: '16px 20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            ✅ Confirmed Batches
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {confirmedJobs}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Committed to live catalog
          </div>
        </div>

        <div className="panel" style={{ padding: '16px 20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
            ⚠️ Exceptions Flagged
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
            {jobsWithErrors}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Batches with invalid rows
          </div>
        </div>

        <div className="panel" style={{ padding: '16px 20px', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4338ca', textTransform: 'uppercase' }}>
            📄 Records Processed
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#312e81', marginTop: '4px' }}>
            {totalIngestedRows}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Valid catalog records in view
          </div>
        </div>
      </div>

      {/* Quick Launch & Templates Bar */}
      <div
        className="panel"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'linear-gradient(to right, #f8fafc, #f1f5f9)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>📥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
              Standardized Ingestion Templates
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Download pre-formatted CSV templates with headers for ISBNs, formats, and categories.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => downloadTemplate('books-editions')}
            style={{ fontSize: '12px' }}
          >
            📄 Books & Editions Template
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => downloadTemplate('catalog-categories')}
            style={{ fontSize: '12px' }}
          >
            📄 Categories Template
          </button>
          {!isHistory && (
            <Link href="/publishing-catalog/import-job-history" className="btn btn-sm" style={{ fontSize: '12px' }}>
              📜 View Ingestion History
            </Link>
          )}
          {isHistory && (
            <Link href="/publishing-catalog/bulk-import-preview" className="btn btn-sm" style={{ fontSize: '12px' }}>
              🔍 Bulk Import Preview
            </Link>
          )}
        </div>
      </div>

      {/* Main Jobs Table / History */}
      <div className="panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: '16px' }}>
            Catalog Ingestion Log ({total} {total === 1 ? 'batch' : 'batches'})
          </h2>
        </div>

        {loading ? (
          <div className="panel empty" style={{ padding: '40px', textAlign: 'center' }}>
            Loading ingestion history…
          </div>
        ) : jobs.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px dashed #d1d5db',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
            <div style={{ fontWeight: 700, color: '#1f2937', fontSize: '16px' }}>
              No catalog import jobs recorded yet
            </div>
            <p className="muted" style={{ maxWidth: '480px', margin: '6px auto 16px auto', fontSize: '13px' }}>
              Enterprise bulk imports allow you to onboard hundreds of titles, editions, and categories at once with automatic check-digit verification and error logging.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowWizard(true)}
              >
                ➕ Start First Import
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => downloadTemplate('books-editions')}
              >
                📄 Download Sample CSV
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '100px' }}>Job ID</th>
                    <th>Uploaded File</th>
                    <th>Dataset</th>
                    <th>Uploaded By</th>
                    <th style={{ width: '105px' }}>Date</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Total</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Valid</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Invalid</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Duplicates</th>
                    <th style={{ width: '110px' }}>Status</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.id}>
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            background: '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                          }}
                        >
                          {job.id.slice(0, 8)}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{job.fileName}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: '#e0e7ff',
                            color: '#3730a3',
                            fontWeight: 600,
                          }}
                        >
                          {job.entityKey}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: '#4b5563' }}>{job.uploadedBy || '—'}</td>
                      <td style={{ fontSize: '12px', color: '#6b7280' }}>{day(job.createdAt)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{job.totalRows}</td>
                      <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                        {job.validRows}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: job.invalidRows > 0 ? '#dc2626' : '#9ca3af',
                          fontWeight: job.invalidRows > 0 ? 700 : 400,
                        }}
                      >
                        {job.invalidRows}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: job.duplicateRows > 0 ? '#d97706' : '#9ca3af',
                          fontWeight: job.duplicateRows > 0 ? 700 : 400,
                        }}
                      >
                        {job.duplicateRows}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            textTransform: 'uppercase',
                            background:
                              job.status === 'confirmed' || job.status === 'imported'
                                ? '#ecfdf5'
                                : job.status === 'validated'
                                ? '#eff6ff'
                                : job.status === 'rejected'
                                ? '#fef2f2'
                                : '#fffbeb',
                            color:
                              job.status === 'confirmed' || job.status === 'imported'
                                ? '#065f46'
                                : job.status === 'validated'
                                ? '#1e40af'
                                : job.status === 'rejected'
                                ? '#991b1b'
                                : '#92400e',
                          }}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => void openDetail(job.id)}
                          style={{ padding: '3px 8px', fontSize: '12px' }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="catalog-pagination" style={{ marginTop: '16px' }}>
              <span>
                {total} total jobs · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
              </span>
              <div className="button-row">
                <button
                  type="button"
                  className="btn"
                  disabled={page === 0}
                  onClick={() => setPage(v => v - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={(page + 1) * 25 >= total}
                  onClick={() => setPage(v => v + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Row-Level Inspection Modal / Workbench */}
      {detail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '960px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
                paddingBottom: '14px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                    Batch Inspection: {detail.fileName}
                  </h3>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      background: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {detail.id}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                      background:
                        detail.status === 'confirmed' || detail.status === 'imported'
                          ? '#ecfdf5'
                          : '#eff6ff',
                      color:
                        detail.status === 'confirmed' || detail.status === 'imported'
                          ? '#065f46'
                          : '#1e40af',
                    }}
                  >
                    {detail.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Uploaded by <strong>{detail.uploadedBy}</strong> on {new Date(detail.createdAt).toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {detail.invalidRows + detail.duplicateRows > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void downloadErrors(detail.id)}
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>📥</span>
                    <span>Download Error CSV</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setDetail(null)}
                  style={{ padding: '2px 8px', fontSize: '14px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px',
                marginBottom: '16px',
              }}
            >
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Rows
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{detail.totalRows}</div>
              </div>
              <div style={{ background: '#ecfdf5', padding: '10px 14px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, textTransform: 'uppercase' }}>
                  Valid Rows
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#065f46' }}>{detail.validRows}</div>
              </div>
              <div style={{ background: '#fef2f2', padding: '10px 14px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, textTransform: 'uppercase' }}>
                  Invalid Rows
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#991b1b' }}>{detail.invalidRows}</div>
              </div>
              <div style={{ background: '#fffbeb', padding: '10px 14px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, textTransform: 'uppercase' }}>
                  Duplicates
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#92400e' }}>{detail.duplicateRows}</div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {(['all', 'failed', 'valid'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailRowTab(tab)}
                  className="btn btn-sm"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    background: detailRowTab === tab ? '#4f46e5' : undefined,
                    color: detailRowTab === tab ? '#ffffff' : undefined,
                    fontWeight: detailRowTab === tab ? 700 : 400,
                  }}
                >
                  {tab === 'all'
                    ? `All Rows (${detail.rows.length})`
                    : tab === 'failed'
                    ? `Errors & Duplicates (${detail.invalidRows + detail.duplicateRows})`
                    : `Valid (${detail.validRows})`}
                </button>
              ))}
            </div>

            {/* Rows Table */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
              {filteredDetailRows.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                  No rows matching this filter tab.
                </div>
              ) : (
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Row #</th>
                      <th style={{ width: '100px' }}>Status</th>
                      <th>Mapped Content</th>
                      <th>Validation Errors / Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetailRows.map(row => (
                      <tr key={row.rowNumber}>
                        <td style={{ fontWeight: 600, color: '#6b7280' }}>#{row.rowNumber}</td>
                        <td>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '999px',
                              textTransform: 'uppercase',
                              background:
                                row.status === 'valid' || row.status === 'imported'
                                  ? '#ecfdf5'
                                  : row.status === 'duplicate'
                                  ? '#fffbeb'
                                  : '#fef2f2',
                              color:
                                row.status === 'valid' || row.status === 'imported'
                                  ? '#065f46'
                                  : row.status === 'duplicate'
                                  ? '#92400e'
                                  : '#991b1b',
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px' }}>
                          {Object.entries(row.mapped)
                            .filter(([_, v]) => v !== undefined && v !== null && v !== '')
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ') || <span className="muted">—</span>}
                        </td>
                        <td>
                          {row.errors.length > 0 ? (
                            <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 500 }}>
                              {row.errors.join('; ')}
                            </span>
                          ) : (
                            <span style={{ color: '#059669', fontSize: '12px' }}>✓ Verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6-Step Bulk Import Wizard */}
      {showWizard && (
        <BulkImportWizard
          moduleKey="publishing-catalog"
          allowedEntityKeys={['books-editions', 'catalog-categories']}
          onClose={() => setShowWizard(false)}
          onImported={() => {
            setShowWizard(false);
            void load();
          }}
        />
      )}
    </>
  );
}
