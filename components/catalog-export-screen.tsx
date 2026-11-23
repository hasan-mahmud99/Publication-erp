"use client";

import { useEffect, useState, useMemo } from 'react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type ExportTypeKey = 'books' | 'editions' | 'identifiers' | 'categories' | 'prices';

interface DatasetMeta {
  key: ExportTypeKey;
  label: string;
  icon: string;
  description: string;
  columns: string[];
}

const DATASETS: DatasetMeta[] = [
  {
    key: 'books',
    label: 'Book Master Catalog',
    icon: '📚',
    description: 'Core book records including title, catalog code, publisher, category, and publication status.',
    columns: ['Code', 'Title', 'Status', 'Publisher', 'Category'],
  },
  {
    key: 'editions',
    label: 'Edition Register',
    icon: '📦',
    description: 'Specific published iterations including edition number, physical/digital format, and publication date.',
    columns: ['Book', 'Edition', 'Format', 'Publication date', 'Status'],
  },
  {
    key: 'identifiers',
    label: 'ISBN & Identifier Registry',
    icon: '🏷️',
    description: 'Assigned ISBN-13, ISSN, Barcodes, and DOI keys with agency validation status.',
    columns: ['Book', 'Edition', 'Type', 'Value', 'Status'],
  },
  {
    key: 'categories',
    label: 'Categories & Taxonomy',
    icon: '📁',
    description: 'Hierarchical subject codes, classification names, and taxonomy status.',
    columns: ['Code', 'Name', 'Status'],
  },
  {
    key: 'prices',
    label: 'Price List Schedules',
    icon: '💰',
    description: 'Multi-currency retail and wholesale price schedules with effective-date windows.',
    columns: ['Book', 'Edition', 'Type', 'Currency', 'Amount', 'From', 'To', 'Status'],
  },
];

export function CatalogExportScreen({ screen }: { screen: Screen }) {
  const [selectedType, setSelectedType] = useState<ExportTypeKey>('books');

  // Filter state
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [format, setFormat] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Counts for all datasets
  const [counts, setCounts] = useState<Record<ExportTypeKey, number | null>>({
    books: null,
    editions: null,
    identifiers: null,
    categories: null,
    prices: null,
  });

  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Helper to construct query params
  function buildParams() {
    const params = new URLSearchParams({ type: selectedType });
    if (selectedType === 'books' || selectedType === 'editions') {
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (selectedType === 'editions' && format) params.set('format', format);
    }
    return params;
  }

  // Load baseline counts for all dataset cards
  async function loadSummaryCounts() {
    try {
      const results = await Promise.all(
        DATASETS.map(d =>
          api<{ data: { count: number } }>(`/catalog/export/count?type=${d.key}`)
            .then(res => ({ key: d.key, count: res.data.count }))
            .catch(() => ({ key: d.key, count: 0 }))
        )
      );

      const newCounts = { ...counts };
      results.forEach(r => {
        newCounts[r.key] = r.count;
      });
      setCounts(newCounts);
    } catch {
      // Ignored for baseline
    }
  }

  // Load count for active dataset + filters
  async function loadActiveCount() {
    setError('');
    setLoading(true);
    try {
      const res = await api<{ data: { count: number } }>(`/catalog/export/count?${buildParams()}`);
      setFilteredCount(res.data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not count matching records');
      setFilteredCount(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummaryCounts();
  }, []);

  useEffect(() => {
    void loadActiveCount();
  }, [selectedType, query, status, format, fromDate, toDate]);

  function handleTypeChange(key: ExportTypeKey) {
    setSelectedType(key);
    setQueryInput('');
    setQuery('');
    setStatus('');
    setFormat('');
    setFromDate('');
    setToDate('');
  }

  async function handleDownload() {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const blob = await apiFile(`/catalog/export.csv?${buildParams()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catalog-${selectedType}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`Successfully generated and downloaded ${selectedType} export (${filteredCount ?? 0} records).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed');
    } finally {
      setBusy(false);
    }
  }

  const activeDataset = useMemo(
    () => DATASETS.find(d => d.key === selectedType)!,
    [selectedType]
  );

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Extract catalog masters, editions, identifiers, and price schedules into sanitized, RFC-compliant CSV files.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn"
            onClick={() => {
              void loadSummaryCounts();
              void loadActiveCount();
            }}
          >
            🔄 Refresh Counts
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

      {/* Dataset Selection Cards */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#4b5563', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          1. Select Catalog Dataset to Export
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '12px',
          }}
        >
          {DATASETS.map(dataset => {
            const isSelected = selectedType === dataset.key;
            const count = counts[dataset.key];
            return (
              <div
                key={dataset.key}
                onClick={() => handleTypeChange(dataset.key)}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #4f46e5' : '1px solid var(--border, #e5e7eb)',
                  background: isSelected ? 'var(--panel-active-bg, #f5f3ff)' : 'var(--panel-bg, #ffffff)',
                  boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{dataset.icon}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: isSelected ? '#4f46e5' : '#f3f4f6',
                      color: isSelected ? '#ffffff' : '#4b5563',
                    }}
                  >
                    {count !== null ? `${count} rows` : '…'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? '#3730a3' : '#111827' }}>
                  {dataset.label}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', lineHeight: 1.35 }}>
                  {dataset.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Configuration & Export Workbench */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Filters and Schema Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Filters Card */}
          <div className="panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 className="section-title" style={{ margin: 0, fontSize: '16px' }}>
                  2. Apply Export Filters ({activeDataset.label})
                </h2>
                <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '12px' }}>
                  Filter records before downloading to target specific releases or categories.
                </p>
              </div>

              {(query || status || format || fromDate || toDate) && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setQueryInput('');
                    setQuery('');
                    setStatus('');
                    setFormat('');
                    setFromDate('');
                    setToDate('');
                  }}
                  style={{ fontSize: '11px' }}
                >
                  ✕ Clear Filters
                </button>
              )}
            </div>

            {selectedType === 'books' || selectedType === 'editions' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Search Keyword</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        className="input"
                        placeholder="Search title, ISBN or catalog code..."
                        value={queryInput}
                        onChange={e => setQueryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') setQuery(queryInput.trim());
                        }}
                      />
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setQuery(queryInput.trim())}
                      >
                        Apply
                      </button>
                    </div>
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Publication Status</span>
                    <select
                      className="input"
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value={selectedType === 'books' ? 'discontinued' : 'archived'}>
                        {selectedType === 'books' ? 'Discontinued' : 'Archived'}
                      </option>
                    </select>
                  </label>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: selectedType === 'editions' ? '1fr 1fr 1fr' : '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  {selectedType === 'editions' && (
                    <label className="field">
                      <span style={{ fontWeight: 600 }}>Book Format</span>
                      <select
                        className="input"
                        value={format}
                        onChange={e => setFormat(e.target.value)}
                      >
                        <option value="">All Formats</option>
                        <option value="paperback">Paperback</option>
                        <option value="hardcover">Hardcover</option>
                        <option value="ebook">eBook (Digital)</option>
                        <option value="audiobook">Audiobook</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  )}

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>From Publication Date</span>
                    <input
                      type="date"
                      className="input"
                      value={fromDate}
                      onChange={e => setFromDate(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>To Publication Date</span>
                    <input
                      type="date"
                      className="input"
                      value={toDate}
                      onChange={e => setToDate(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '16px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  color: '#4b5563',
                  fontSize: '13px',
                }}
              >
                ℹ️ The <strong>{activeDataset.label}</strong> dataset exports all master records configured for your organization without requiring date segmentation.
              </div>
            )}
          </div>

          {/* Schema & Column Specification Preview */}
          <div className="panel" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700 }}>
              3. CSV Output Schema & Columns
            </h3>
            <p className="muted" style={{ margin: '0 0 14px 0', fontSize: '12px' }}>
              The exported file will be delivered with UTF-8 encoding and the following standardized header columns:
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {activeDataset.columns.map((col, idx) => (
                <div
                  key={col}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  <span style={{ color: '#9ca3af', fontSize: '11px', fontFamily: 'monospace' }}>
                    #{idx + 1}
                  </span>
                  <span>{col}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Download & Governance Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Action Download Panel */}
          <div
            className="panel"
            style={{
              padding: '24px',
              borderTop: '4px solid #4f46e5',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
              Export Summary
            </div>

            <div style={{ marginTop: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827' }}>
                {loading ? '…' : filteredCount === null ? '0' : filteredCount.toLocaleString()}
              </div>
              <div style={{ fontSize: '13px', color: '#4b5563', fontWeight: 500 }}>
                Authorized records ready for extraction
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#6b7280' }}>Dataset:</span>
                <span style={{ fontWeight: 600 }}>{activeDataset.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#6b7280' }}>Target Filename:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>catalog-{selectedType}.csv</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#6b7280' }}>Encoding:</span>
                <span style={{ fontWeight: 600 }}>UTF-8 (with BOM)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#6b7280' }}>Row Limit:</span>
                <span style={{ fontWeight: 600, color: '#059669' }}>Max 5,000 rows</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || loading || filteredCount === null || filteredCount === 0 || filteredCount > 5000}
              onClick={() => void handleDownload()}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>{busy ? '⏳' : '📥'}</span>
              <span>{busy ? 'Generating CSV…' : 'Download CSV Export'}</span>
            </button>

            {filteredCount !== null && filteredCount > 5000 && (
              <p className="alert-error" style={{ fontSize: '12px', marginTop: '10px' }}>
                ⚠️ Record count exceeds 5,000 rows limit. Please apply date or status filters before exporting.
              </p>
            )}
          </div>

          {/* Governance & Safety Card */}
          <div
            className="panel"
            style={{
              padding: '18px',
              background: '#fcfcfd',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px' }}>🛡️</span>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Enterprise Data Governance</span>
            </div>

            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#4b5563', lineHeight: 1.6 }}>
              <li>
                <strong>Formula Injection Protection:</strong> Cells beginning with <code>=</code>, <code>+</code>, <code>-</code>, or <code>@</code> are sanitized to protect against spreadsheet formula execution.
              </li>
              <li>
                <strong>Audit Trail Logging:</strong> Every download event registers an immutable <code>EXPORT</code> entry in the compliance audit trail.
              </li>
              <li>
                <strong>Access Control:</strong> Requires explicit <code>exports.create</code> permission or workspace Owner authorization.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
