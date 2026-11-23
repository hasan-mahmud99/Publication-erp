"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Row = Record<string, any>;
type Data = { statuses: Row[]; missingValidatedIsbn: number; editions: Row[]; total: number; months: Row[]; limit: number; offset: number; generatedAt: string; basis: string };
export function ReportEditionScreen() {
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [status, setStatus] = useState(''), [publisherId, setPublisherId] = useState('');
  const [publishers, setPublishers] = useState<Row[]>([]), [data, setData] = useState<Data | null>(null), [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  async function load(nextPage = page) {
    if (from && to && from > to) { setError('Start date must not exceed end date'); return; }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '20', offset: String(nextPage * 20) });
      if (from) params.set('from', from); if (to) params.set('to', to); if (status) params.set('status', status); if (publisherId) params.set('publisherId', publisherId);
      const [report, options] = await Promise.all([api<{ data: Data }>(`/reports/edition-lifecycle?${params}`), api<{ data: Row[] }>('/publishers')]);
      setData(report.data); setPublishers(options.data); setPage(nextPage);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load edition lifecycle'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(0); }, []);
  const max = Math.max(1, ...(data?.months || []).map(row => Number(row.editions)));
  return <>
    <div className="page-heading"><div><h1 className="page-title">Edition Lifecycle Analytics</h1><p className="muted">Current edition states and validated ISBN coverage</p></div></div>
    <section className="panel catalog-form"><h2 className="section-title">Edition filters</h2><div className="catalog-form-grid"><label className="field">Publication from<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field">Publication to<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label><label className="field">Status<select className="input" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{data?.statuses.map(row => <option key={row.status} value={row.status}>{row.status}</option>)}</select></label><label className="field">Publisher<select className="input" value={publisherId} onChange={event => setPublisherId(event.target.value)}><option value="">All publishers</option>{publishers.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div><button className="btn btn-primary" onClick={() => void load(0)}>Apply filters</button></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{loading ? <div className="panel empty">Loading edition records…</div> : data && <>
      <p className="muted">{data.basis}. Generated {new Date(data.generatedAt).toLocaleString('en-BD')}.</p>
      <div className="stat-grid"><div className="panel stat"><div className="stat-label">Matching edition rows</div><div className="stat-value">{data.total}</div></div><div className="panel stat"><div className="stat-label">Editions without validated ISBN</div><div className="stat-value">{data.missingValidatedIsbn}</div></div>{data.statuses.map(row => <div className="panel stat" key={row.status}><div className="stat-label">{row.status} editions</div><div className="stat-value">{row.editions}</div></div>)}</div>
      <section className="panel catalog-form"><h2 className="section-title">Publication timeline</h2>{data.months.length ? data.months.map(row => <div className="field" key={row.month}><strong>{row.month} · {row.editions} editions</strong><div style={{ height: 12, background: '#e8eef9', borderRadius: 6 }}><div style={{ height: 12, width: `${100 * Number(row.editions) / max}%`, background: '#2547aa', borderRadius: 6 }} /></div></div>) : <p className="muted">No editions have a publication date in this range.</p>}</section>
      <section className="panel catalog-form"><h2 className="section-title">Edition register</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Book</th><th>Edition</th><th>Publisher</th><th>Format</th><th>Publication</th><th>Status</th><th>Validated ISBN</th></tr></thead><tbody>{data.editions.length ? data.editions.map(row => <tr key={row.id}><td>{row.book_title}</td><td>{row.edition_code || row.edition_number}</td><td>{row.publisher_name || 'Unassigned'}</td><td>{row.format}</td><td>{row.publication_date ? String(row.publication_date).slice(0, 10) : 'Undated'}</td><td>{row.status}</td><td>{row.has_validated_isbn ? 'Yes' : 'No'}</td></tr>) : <tr><td colSpan={7}>No editions match the filters.</td></tr>}</tbody></table></div><div className="button-row"><button className="btn" disabled={page === 0} onClick={() => void load(page - 1)}>Previous</button><span>{data.total} editions · page {page + 1}</span><button className="btn" disabled={(page + 1) * 20 >= data.total} onClick={() => void load(page + 1)}>Next</button></div></section>
      <p className="muted">Status counts and ISBN coverage reflect the current catalog; publication dates filter the register and timeline. <Link href="/publishing-catalog/edition-list">Open edition master data</Link>.</p>
    </>}
  </>;
}
