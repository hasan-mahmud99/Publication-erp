'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  FileText,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Upload,
  Eye,
  Lock,
  Download,
  BookOpen,
  DollarSign
} from 'lucide-react';

type Edition = {
  edition_id: string;
  edition_code: string | null;
  edition_number: string;
  format: string;
  language_code: string;
  edition_status: string;
  book_title: string;
  active_asset_id: string | null;
  file_name: string | null;
  asset_version: number | null;
  digital_price: string | null;
  valid_rights_grant_id: string | null;
  readyForReview: boolean;
  customerAccessEnabled: boolean;
};

export function EcommerceDigitalReadinessScreen() {
  const [rows, setRows] = useState<Edition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Watermark preview modal
  const [watermarkEdition, setWatermarkEdition] = useState<Edition | null>(null);
  const [readerEmail, setReaderEmail] = useState('licensed.reader@example.com');
  const [uploadEdition, setUploadEdition] = useState<Edition | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ data: Edition[] }>('/ecommerce/digital-readiness');
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (cause: any) {
      setError(cause?.message || 'Could not load digital editions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const safeRows = Array.isArray(rows) ? rows : [];

  const filteredRows = safeRows.filter((r) => {
    if (filter === 'ready' && !r.readyForReview) return false;
    if (filter === 'missing' && r.readyForReview) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = r.book_title?.toLowerCase().includes(q);
      const matchCode = (r.edition_code || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCode) return false;
    }
    return true;
  });

  const totalDigital = safeRows.length;
  const readyCount = safeRows.filter((r) => r.readyForReview).length;
  const assetUploadedCount = safeRows.filter((r) => Boolean(r.active_asset_id)).length;
  const rightsValidatedCount = safeRows.filter((r) => Boolean(r.valid_rights_grant_id)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#7c3aed' }}>
              DIGITAL ASSETS &amp; RIGHTS VALIDATION GATE
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: '#f5f3ff',
                color: '#6d28d9',
              }}
            >
              DRM &amp; Territorial Compliance
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Digital Product &amp; Access Management
          </h1>
          <p className="muted">
            Manage EPUB, PDF and Audiobook master assets, verify effective BDT list prices, inspect statutory Bangladesh copyright grants, and test forensic watermarking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notices */}
      {error && (
        <div className="panel" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 14 }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {notice && (
        <div className="panel" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="panel stat">
          <div className="stat-label">Total Digital Catalog</div>
          <div className="stat-value" style={{ color: '#2563eb' }}>{totalDigital}</div>
          <div className="stat-note">eBook &amp; Audiobook titles</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Master Files Uploaded</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>
            {assetUploadedCount} / {totalDigital}
          </div>
          <div className="stat-note">Stored in catalog_digital_assets</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Territorial Rights Validated</div>
          <div className="stat-value" style={{ color: '#7c3aed' }}>
            {rightsValidatedCount} / {totalDigital}
          </div>
          <div className="stat-note">Active BD Territorial Grant</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Ready for Distribution</div>
          <div className="stat-value" style={{ color: '#0891b2' }}>{readyCount}</div>
          <div className="stat-note">Asset + Price + Rights verified</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel" style={{ padding: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="input"
              placeholder="Search by Book Title or Edition Code..."
              style={{ width: 280 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'all', label: 'All Digital Titles' },
                { key: 'ready', label: 'Ready for Review' },
                { key: 'missing', label: 'Missing Requirements' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className="btn"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderColor: filter === tab.key ? '#7c3aed' : '#e2e8f0',
                    background: filter === tab.key ? '#f5f3ff' : '#ffffff',
                    color: filter === tab.key ? '#6d28d9' : '#64748b',
                  }}
                  onClick={() => setFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <span style={{ fontSize: 13, color: '#64748b' }}>
            Showing {filteredRows.length} editions
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="panel table-wrap" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Digital Editions Master Registry
          </h2>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {filteredRows.length} titles
          </span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Book Title &amp; Edition</th>
              <th>Format</th>
              <th>Master Asset</th>
              <th>Effective Price</th>
              <th>Bangladesh Rights (BD)</th>
              <th>Readiness Gate</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  Loading digital editions and access gates...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  No digital editions found matching filter criteria.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const hasAsset = Boolean(r.active_asset_id);
                const hasPrice = r.digital_price !== null;
                const hasRights = Boolean(r.valid_rights_grant_id);

                return (
                  <tr key={r.edition_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <BookOpen size={16} />
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a' }}>{r.book_title}</strong>
                          <p className="muted" style={{ fontSize: 11.5, margin: '2px 0 0' }}>
                            {r.edition_code || r.edition_number} · Lang: {r.language_code?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: r.format === 'ebook' ? '#eff6ff' : '#f0fdf4',
                          color: r.format === 'ebook' ? '#1d4ed8' : '#15803d',
                          textTransform: 'uppercase',
                        }}
                      >
                        {r.format}
                      </span>
                    </td>
                    <td>
                      {hasAsset ? (
                        <div>
                          <strong style={{ color: '#0f172a', fontSize: 12.5 }}>{r.file_name}</strong>
                          <div style={{ fontSize: 11.5, color: '#16a34a' }}>✓ Active Asset v{r.asset_version}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
                          Missing Asset File
                        </span>
                      )}
                    </td>
                    <td>
                      {hasPrice ? (
                        <strong style={{ color: '#0f172a' }}>BDT {Number(r.digital_price).toFixed(2)}</strong>
                      ) : (
                        <span style={{ color: '#d97706', fontSize: 12 }}>Unpriced</span>
                      )}
                    </td>
                    <td>
                      {hasRights ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#dcfce7',
                            color: '#15803d',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <ShieldCheck size={12} />
                          <span>Approved Grant</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#fee2e2',
                            color: '#b91c1c',
                          }}
                        >
                          Missing Grant
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          textTransform: 'uppercase',
                          background: r.readyForReview ? '#dcfce7' : '#f1f5f9',
                          color: r.readyForReview ? '#15803d' : '#64748b',
                        }}
                      >
                        {r.readyForReview ? 'Ready for Release' : 'Incomplete'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          onClick={() => setWatermarkEdition(r)}
                        >
                          <Eye size={13} />
                          <span>Preview DRM</span>
                        </button>
                        <Link
                          className="btn"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          href={`/authors-contracts-rights/rights-and-territory-register`}
                        >
                          Rights
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

      {/* Forensic Watermark & DRM Preview Modal */}
      {watermarkEdition && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 580,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={18} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Forensic DRM Watermark Simulation
                </h3>
              </div>
              <button type="button" className="btn" onClick={() => setWatermarkEdition(null)}>
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Every digital delivery injects an encrypted forensic footer on each page to protect publisher copyright against unauthorized redistribution.
            </p>

            <label className="field">
              <span>Test Reader Email / Licensee:</span>
              <input
                type="email"
                className="input"
                value={readerEmail}
                onChange={(e) => setReaderEmail(e.target.value)}
              />
            </label>

            {/* Visual Simulated Watermark Page */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 8,
                padding: 20,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 180,
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong style={{ fontSize: 15, color: '#0f172a' }}>{watermarkEdition.book_title}</strong>
                <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                  Chapter 1: Foundations &amp; Modern Frameworks
                </p>
                <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 10 }}>
                  Sample text from digital publication master file. Intellectual property protected under Bangladesh Copyright Act 2023. All rights reserved.
                </p>
              </div>

              {/* Watermark Footer */}
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: 8,
                  fontSize: 10.5,
                  color: '#94a3b8',
                  fontFamily: 'monospace',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>LICENSED TO: {readerEmail}</span>
                <span>SHA: 4a9f20e8..bd · 2026-11-17</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-primary" onClick={() => setWatermarkEdition(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
