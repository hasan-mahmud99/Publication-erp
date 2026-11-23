"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Globe,
  ShieldCheck,
  RefreshCw,
  Search,
  ExternalLink,
  Clock,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Grant = Record<string, any>;
const root = '/authors-contracts-rights';
const date = (value: unknown) => (value ? String(value).slice(0, 10) : 'Open ended');
const rights = [
  'print',
  'digital',
  'translation',
  'audiobook',
  'reprint',
  'distribution',
  'adaptation',
  'other',
];

function futureDate(days: number) {
  const today = new Date();
  today.setDate(today.getDate() + days);
  return today.toISOString().slice(0, 10);
}

export function RightsGrantsScreen({ screen }: { screen: Screen }) {
  const expiry = screen.title === 'Rights Expiry Calendar';
  const [rows, setRows] = useState<Grant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [rightType, setRightType] = useState('');
  const [territory, setTerritory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(() => (expiry ? futureDate(90) : ''));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (search) params.set('q', search);
      if (rightType) params.set('rightType', rightType);
      if (territory.trim()) params.set('territory', territory.trim().toUpperCase());
      if (expiry && from) params.set('from', from);
      if (expiry && to) params.set('to', to);
      const result = await api<{ data: { data: Grant[]; meta: { total: number } } }>(`/rights/grants?${params}`);
      setRows(result.data.data);
      setTotal(result.data.meta.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load rights grants');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [screen.id, page, search, rightType, territory, from, to]);

  // KPI calculations
  const totalCount = total;
  const worldwideCount = rows.filter(r => r.territory === 'ALL').length;
  const exclusiveCount = rows.filter(r => r.exclusive).length;
  const overdueCount = rows.filter(r => r.days_remaining != null && Number(r.days_remaining) < 0).length;
  const next30dCount = rows.filter(
    r => r.days_remaining != null && Number(r.days_remaining) >= 0 && Number(r.days_remaining) <= 30
  ).length;
  const next90dCount = rows.filter(
    r => r.days_remaining != null && Number(r.days_remaining) >= 0 && Number(r.days_remaining) <= 90
  ).length;

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{expiry ? '📅' : '⚖️'}</span> {screen.title}
          </h1>
          <p className="muted">
            {expiry
              ? 'Calendar schedule of expiring publishing agreements and renewal notice deadlines.'
              : 'Register of active territorial, translation, format, and exclusive publishing rights granted from approved agreements.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void load()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Info Callout */}
      <div
        style={{
          padding: '12px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>ℹ️</span>
        <span>
          Rights are granted strictly through approved publisher-author contracts. To extend a scope or renew an expiring agreement, open the contract detail page and create a new amendment.
        </span>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Top KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        {!expiry ? (
          <>
            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #4f46e5',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase' }}>
                ⚖️ Active Grants
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                {totalCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Approved rights registered
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #10b981',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
                🔒 Exclusive Scopes
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
                {exclusiveCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Sole publisher exclusivity
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #0ea5e9',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
                🌐 Worldwide Coverage
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
                {worldwideCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Global rights territory (ALL)
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #f59e0b',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
                ⏳ Expiring in 90 Days
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
                {next90dCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Requires renewal notice
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #4f46e5',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase' }}>
                📅 Monitored Expiries
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                {totalCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Agreements in active calendar filter
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #b91c1c',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase' }}>
                ⚠️ Lapsed / Overdue
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#991b1b', marginTop: '4px' }}>
                {overdueCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Past contractual end date
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #f59e0b',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
                ⏳ Expiring &lt; 30 Days
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
                {next30dCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Critical renegotiation window
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #0ea5e9',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
                🗓️ Expiring &lt; 90 Days
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
                {next90dCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Approaching term conclusion
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', flex: 1 }}>
            <div style={{ display: 'flex', gap: '6px', minWidth: '240px' }}>
              <input
                className="input"
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    setPage(0);
                    setSearch(searchInput.trim());
                  }
                }}
                placeholder="🔍 Search book, contract or author..."
                style={{ fontSize: '13px' }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPage(0);
                  setSearch(searchInput.trim());
                }}
              >
                Search
              </button>
            </div>

            <select
              className="input"
              value={rightType}
              onChange={event => {
                setPage(0);
                setRightType(event.target.value);
              }}
              style={{ fontSize: '13px', width: 'auto' }}
            >
              <option value="">All Rights</option>
              {rights.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <input
              className="input"
              maxLength={8}
              value={territory}
              onChange={event => {
                setPage(0);
                setTerritory(event.target.value.toUpperCase());
              }}
              placeholder="Territory (BD / ALL)"
              style={{ fontSize: '13px', width: '150px' }}
            />

            {expiry && (
              <>
                <input
                  className="input"
                  type="date"
                  title="Expiring from"
                  value={from}
                  onChange={event => {
                    setPage(0);
                    setFrom(event.target.value);
                  }}
                  style={{ fontSize: '13px', width: 'auto' }}
                />
                <input
                  className="input"
                  type="date"
                  title="Expiring through"
                  value={to}
                  onChange={event => {
                    setPage(0);
                    setTo(event.target.value);
                  }}
                  style={{ fontSize: '13px', width: 'auto' }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  {[30, 90, 180, 365].map(days => (
                    <button
                      key={days}
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setPage(0);
                        setFrom('');
                        setTo(futureDate(days));
                      }}
                    >
                      {days}d
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setPage(0);
                      setFrom('');
                      setTo('');
                    }}
                  >
                    All
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Showing <strong>{rows.length}</strong> of <strong>{total}</strong> grants
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '32px' }}>
          Loading rights grants…
        </div>
      ) : (
        <>
          <div className="panel table-wrap" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Book &amp; Author</th>
                  <th style={{ width: '18%' }}>Agreement &amp; Grant</th>
                  <th style={{ width: '27%' }}>Permitted Use Scope</th>
                  <th style={{ width: '14%' }}>Coverage Specs</th>
                  <th style={{ width: '10%' }}>Term &amp; Expiry</th>
                  <th style={{ width: '6%', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map(grant => (
                    <tr key={grant.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>{grant.book_title}</strong>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{grant.author_name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: 12, color: '#1e293b' }}>{grant.contract_number}</strong>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                background: '#e0e7ff',
                                color: '#3730a3',
                                padding: '1px 6px',
                                borderRadius: 3,
                                fontSize: 10,
                                textTransform: 'capitalize',
                                fontWeight: 700,
                              }}
                            >
                              {grant.right_type}
                            </span>
                            <span
                              style={{
                                background: grant.exclusive ? '#ecfdf5' : '#f1f5f9',
                                color: grant.exclusive ? '#065f46' : '#64748b',
                                padding: '1px 6px',
                                borderRadius: 3,
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              {grant.exclusive ? 'Exclusive' : 'Non-exclusive'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: '#334155', lineHeight: 1.45 }}>
                        {grant.permitted_use || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Standard publishing rights</span>}
                      </td>
                      <td style={{ fontSize: 11, color: '#475569' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Territory: </span>
                            <code>{grant.territory}</code>
                          </div>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Lang: </span>
                            <code>{grant.language_code}</code>
                          </div>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Format: </span>
                            <code>{grant.format_code}</code>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <div>{date(grant.start_date)}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 11 }}>to {date(grant.end_date)}</div>
                        {grant.days_remaining !== null && (
                          <div
                            style={{
                              marginTop: 2,
                              fontWeight: 700,
                              fontSize: 11,
                              color: Number(grant.days_remaining) < 0 ? '#b91c1c' : '#059669',
                            }}
                          >
                            {Number(grant.days_remaining) < 0
                              ? `${Math.abs(Number(grant.days_remaining))}d overdue`
                              : `${grant.days_remaining}d remaining`}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          className="btn btn-sm"
                          href={`${root}/contract-detail-and-amendments?contract=${grant.contract_id}`}
                        >
                          Contract
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="empty">
                      {expiry ? 'No approved rights expire in this range.' : 'No approved rights match these filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {total} grants · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
            </span>
            <div className="button-row">
              <button className="btn" disabled={page === 0} onClick={() => setPage(value => value - 1)}>
                Previous
              </button>
              <button
                className="btn"
                disabled={(page + 1) * 25 >= total}
                onClick={() => setPage(value => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
