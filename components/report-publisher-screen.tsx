"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Row = { id: string; code: string | null; name: string; publisher_id?: string; titles: number; active_titles?: number; editions: number; published_editions?: number };
type Data = { publishers: Row[]; imprints: Row[]; unassignedTitles: number; basis: string; generatedAt: string; limit: number };
export function ReportPublisherScreen() {
  const [publisherId, setPublisherId] = useState(''), [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  async function load(selected = publisherId) {
    setLoading(true); setError('');
    try { setData((await api<{ data: Data }>(`/reports/catalog-portfolio${selected ? `?publisherId=${selected}` : ''}`)).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load catalog portfolio'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(''); }, []);
  return <>
    <div className="page-heading"><div><h1 className="page-title">Publisher/Imprint Performance</h1><p className="muted">Current portfolio counts at distinct title and edition grains</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    <section className="panel catalog-form"><label className="field">Publisher<select className="input" value={publisherId} onChange={event => setPublisherId(event.target.value)}><option value="">All publishers</option>{data?.publishers.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><button className="btn btn-primary" onClick={() => void load()}>Apply filter</button></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{loading ? <div className="panel empty">Loading catalog records…</div> : data && <>
      <p className="muted">{data.basis}. Generated {new Date(data.generatedAt).toLocaleString('en-BD')}. Maximum {data.limit} publishers and imprints shown.</p>
      <div className="stat-grid"><div className="panel stat"><div className="stat-label">Visible publishers</div><div className="stat-value">{data.publishers.length}</div></div><div className="panel stat"><div className="stat-label">Titles without publisher</div><div className="stat-value">{data.unassignedTitles}</div></div></div>
      <section className="panel catalog-form"><h2 className="section-title">Publisher portfolio</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Publisher</th><th>Titles</th><th>Active titles</th><th>Editions</th><th>Published editions</th></tr></thead><tbody>{data.publishers.length ? data.publishers.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.titles}</td><td>{row.active_titles}</td><td>{row.editions}</td><td>{row.published_editions}</td></tr>) : <tr><td colSpan={5}>No publisher records match.</td></tr>}</tbody></table></div></section>
      <section className="panel catalog-form"><h2 className="section-title">Imprint portfolio</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Imprint</th><th>Titles</th><th>Editions</th></tr></thead><tbody>{data.imprints.length ? data.imprints.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.titles}</td><td>{row.editions}</td></tr>) : <tr><td colSpan={3}>No imprint records match.</td></tr>}</tbody></table></div></section>
      <p className="muted">Sales revenue by publisher is not attributed here until invoice-line reconciliation is verified. <Link href="/publishing-catalog/publisher-and-imprint-management">Open publisher master data</Link>.</p>
    </>}
  </>;
}
