"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Row = Record<string, any>;
type Executive = { books: number; activeBooks: number; editions: number; orders: number; openPrintOrders: number; onHand: number | string; reserved: number | string; openCases: number; postedInvoices: { total: number }; range: { from: string; to: string } };
type Production = { status: Row[]; dueSoon: number; recentOrders: Row[]; orderTotal: number };
type Publishing = { bookStatus: Row[]; editionStatus: Row[]; pendingIdentifiers: number };
const initial = () => { const now = new Date(); return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: now.toISOString().slice(0, 10) }; };
export function ReportOperationalScreen() {
  const defaults = initial(); const [from, setFrom] = useState(defaults.from), [to, setTo] = useState(defaults.to);
  const [data, setData] = useState<{ executive: Executive; production: Production; publishing: Publishing } | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  async function load() {
    if (from > to) { setError('Start date must not exceed end date'); return; }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ from, to });
      const [executive, production, publishing] = await Promise.all([
        api<{ data: Executive }>(`/dashboard/executive?${params}`), api<{ data: Production }>(`/dashboard/production?${params}`), api<{ data: Publishing }>(`/dashboard/publishing?${params}`),
      ]);
      setData({ executive: executive.data, production: production.data, publishing: publishing.data });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Operational KPI report failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const statusMax = Math.max(1, ...(data?.production.status || []).map(row => Number(row.total)));
  return <>
    <div className="page-heading"><div><h1 className="page-title">Operational KPI Dashboard</h1><p className="muted">Source counts for publishing, production, sales and stock</p></div></div>
    <section className="panel catalog-form"><h2 className="section-title">Period filters</h2><div className="catalog-form-grid"><label className="field">From<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field">To<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div><button className="btn btn-primary" onClick={() => void load()}>Apply dates</button><p className="muted">Period applies to orders, posted invoices, book creation and production due dates. Edition, stock, open case and active production totals are current snapshots.</p></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{loading ? <div className="panel empty">Loading operational sources…</div> : data && <>
      <p className="muted">Reporting period: {from} to {to}. Values are live operational source counts, not financial statement figures.</p>
      <div className="stat-grid">{[['Titles · current', data.executive.books], ['Active titles · current', data.executive.activeBooks], ['Editions · current', data.executive.editions], ['Sales orders · period', data.executive.orders], ['Posted invoices · period', data.executive.postedInvoices.total], ['Open print orders · current', data.executive.openPrintOrders], ['Stock on hand · current', data.executive.onHand], ['Open customer cases · current', data.executive.openCases]].map(([label, value]) => <div className="panel stat" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>)}</div>
      <section className="panel catalog-form"><h2 className="section-title">Production orders due in period by status</h2>{data.production.status.length ? data.production.status.map(row => <div className="field" key={row.status}><strong>{row.status} · {row.total}</strong><div style={{ height: 12, background: '#e8eef9', borderRadius: 6 }}><div style={{ height: 12, width: `${100 * Number(row.total) / statusMax}%`, background: '#2547aa', borderRadius: 6 }} /></div></div>) : <p className="muted">No production orders due in this period.</p>}<p className="muted">{data.production.dueSoon} open print orders are due within 14 days from the server date.</p></section>
      <section className="panel catalog-form"><h2 className="section-title">Publishing pipeline</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Book status</th><th>Titles created in period</th></tr></thead><tbody>{data.publishing.bookStatus.length ? data.publishing.bookStatus.map(row => <tr key={row.status}><td>{row.status}</td><td>{row.total}</td></tr>) : <tr><td colSpan={2}>No titles created in this period.</td></tr>}</tbody></table></div><p className="muted">{data.publishing.pendingIdentifiers} identifiers are pending validation (current total).</p></section>
      <p className="muted">Sales orders are not recognized revenue. Posted invoice amount, returns and GL figures are in their dedicated reports. <Link href="/reports-analytics/sales-and-returns-reports">Open Sales & Returns Reports</Link>.</p>
    </>}
  </>;
}
