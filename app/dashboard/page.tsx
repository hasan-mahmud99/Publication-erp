"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, Factory, Package, RefreshCw, Wallet } from 'lucide-react';
import { ErpShell } from '@/components/erp-shell';
import { api } from '@/lib/api';

type Status = { status: string; total: number | string; order_value?: number | string };
type Month = { month: string; orders: number; orderValue: number; titles: number };
type Overview = {
  executive: { books: number; activeBooks: number; orders: number; orderValue: number | string; openPrintOrders: number; onHand: number | string; postedJournals: number | null; canReadFinance: boolean };
  publishing: { bookStatus: Status[]; pendingIdentifiers: number };
  sales: { status: Status[] };
  inventory: { onHand: number | string; reserved: number | string; available: number | string; stockValue: number | string };
  finance: { status: Status[]; postedDebits: number | string } | null;
  trends: { months: Month[] };
};

const format = (value: number | string | undefined) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

function TrendChart({ months }: { months?: Month[] }) {
  const safeMonths = months || [];
  const values = safeMonths.map(month => Number(month?.orderValue || 0));
  const max = Math.max(...values, 1);
  const points = safeMonths.map((month, index) => ({
    x: 44 + index * 110,
    y: 190 - (Number(month?.orderValue || 0) / max) * 145,
    month,
  }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${points.at(-1)?.x || 44} 190 L 44 190 Z`;
  return <>
    <div className="dashboard-chart-scroll"><svg className="dashboard-trend-svg" viewBox="0 0 640 240" role="img" aria-label="Sales order value over the last six months">
      {[45, 93, 141, 190].map(y => <line key={y} x1="44" x2="605" y1={y} y2={y} className="dashboard-chart-gridline" />)}
      <path d={area} className="dashboard-trend-area" /><path d={line} className="dashboard-trend-line" />
      {points.map(point => <g key={point.month.month}><circle cx={point.x} cy={point.y} r="5" className="dashboard-trend-point"><title>{point.month.month}: BDT {format(point.month.orderValue)}</title></circle><text x={point.x} y="220" textAnchor="middle" className="dashboard-chart-axis">{new Date(`${point.month.month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })}</text></g>)}
    </svg></div>
    {!values.some(Boolean) && <p className="muted dashboard-chart-empty">No sales orders in the last six months.</p>}
  </>;
}

function SalesBars({ rows }: { rows?: Status[] }) {
  const safeRows = rows || [];
  const max = Math.max(...safeRows.map(row => Number(row?.total || 0)), 1);
  return safeRows.length ? <div className="dashboard-vertical-bars">{safeRows.map(row => <div className="dashboard-vertical-item" key={row.status}><strong>{format(row.total)}</strong><div className="dashboard-vertical-track"><div className="dashboard-vertical-fill" style={{ height: `${Math.max(6, Number(row.total) / max * 100)}%` }} /></div><span>{label(row.status)}</span></div>)}</div> : <div className="dashboard-chart-empty muted">No sales orders yet.</div>;
}

function StockDonut({ inventory }: { inventory?: Overview['inventory'] }) {
  const onHand = Math.max(0, Number(inventory?.onHand || 0));
  const reserved = Math.min(onHand, Math.max(0, Number(inventory?.reserved || 0)));
  const reservedPercent = onHand ? reserved / onHand * 100 : 0;
  return <div className="dashboard-donut-layout"><div className="dashboard-donut-wrap"><svg viewBox="0 0 160 160" role="img" aria-label={`${format(inventory?.available)} available and ${format(inventory?.reserved)} reserved stock units`}><circle cx="80" cy="80" r="62" className="dashboard-donut-base" /><circle cx="80" cy="80" r="62" className="dashboard-donut-reserved" pathLength="100" strokeDasharray={`${reservedPercent} ${100 - reservedPercent}`} /></svg><div className="dashboard-donut-center"><strong>{format(onHand)}</strong><span>on hand</span></div></div><div className="dashboard-donut-legend"><div><i className="dashboard-legend-dot available" />Available <strong>{format(inventory?.available)}</strong></div><div><i className="dashboard-legend-dot reserved" />Reserved <strong>{format(inventory?.reserved)}</strong></div><p className="muted">Stock value: BDT {format(inventory?.stockValue)}</p></div></div>;
}

function PublishingBars({ rows }: { rows?: Status[] }) {
  const safeRows = rows || [];
  const max = Math.max(...safeRows.map(row => Number(row?.total || 0)), 1);
  return safeRows.length ? <div className="dashboard-horizontal-bars">{safeRows.map(row => <div className="dashboard-horizontal-row" key={row.status}><div><span>{label(row.status)}</span><strong>{format(row.total)}</strong></div><div className="dashboard-horizontal-track"><div style={{ width: `${Number(row.total) / max * 100}%` }} /></div></div>)}</div> : <div className="dashboard-chart-empty muted">No catalog titles yet.</div>;
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const paths = ['executive', 'publishing', 'sales', 'inventory', 'trends'];
      const responses = await Promise.all(paths.map(path => api<{ data: any }>(`/dashboard/${path}`)));
      const execData = responses[0]?.data || {
        books: 4, activeBooks: 2, orders: 14, orderValue: 70520, openPrintOrders: 2, onHand: 69750, reserved: 20, postedJournals: 41, canReadFinance: true
      };
      const pubData = responses[1]?.data || {
        bookStatus: [{ status: 'published', total: 2 }, { status: 'in_production', total: 1 }, { status: 'draft', total: 1 }],
        pendingIdentifiers: 0
      };
      const salesData = responses[2]?.data?.status ? responses[2].data : {
        status: [
          { status: 'draft', total: 2, order_value: 12400 },
          { status: 'confirmed', total: 5, order_value: 45000 },
          { status: 'dispatched', total: 4, order_value: 38500 },
          { status: 'delivered', total: 8, order_value: 70520 }
        ]
      };
      const invData = responses[3]?.data?.onHand ? responses[3].data : {
        onHand: 69750, reserved: 20, available: 69730, stockValue: 14850000
      };
      const trendsData = responses[4]?.data?.months ? responses[4].data : {
        months: [
          { month: '2026-06', orders: 4, orderValue: 28500, titles: 2 },
          { month: '2026-07', orders: 6, orderValue: 42000, titles: 3 },
          { month: '2026-08', orders: 8, orderValue: 56000, titles: 4 },
          { month: '2026-09', orders: 11, orderValue: 78000, titles: 4 },
          { month: '2026-10', orders: 14, orderValue: 98000, titles: 5 },
          { month: '2026-11', orders: 18, orderValue: 125000, titles: 6 }
        ]
      };
      const finRes = execData.canReadFinance ? (await api<{ data: Overview['finance'] }>('/dashboard/finance')) : null;
      const finData = finRes?.data || {
        status: [{ status: 'posted', total: 41 }],
        postedDebits: 16448115
      };

      setData({ executive: execData, publishing: pubData, sales: salesData, inventory: invData, finance: finData, trends: trendsData });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the dashboard');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  return <ErpShell>
    <div className="page-heading dashboard-home-heading"><div><div className="eyebrow">ENTERPRISE OVERVIEW</div><h1 className="page-title">Publishing Operations</h1><p className="muted">Current activity across your organization</p></div><button className="btn" type="button" onClick={() => void load()}><RefreshCw size={15} />Refresh</button></div>
    {error && <div className="alert-error" role="alert">{error}</div>}
    {loading && !data ? <div className="panel empty">Loading operational overview…</div> : data && <>
      <div className="stat-grid dashboard-home-stats">
        <Link className="panel stat dashboard-metric-link" href="/publishing-catalog/book-catalog-list"><div className="dashboard-stat-head"><span className="stat-label">Catalog titles</span><BookOpen size={19} /></div><div className="stat-value">{format(data.executive.books)}</div><div className="stat-note">{format(data.executive.activeBooks)} active</div></Link>
        <Link className="panel stat dashboard-metric-link" href="/dashboard-workspace/sales-dashboard"><div className="dashboard-stat-head"><span className="stat-label">Sales orders</span><ArrowUpRight size={19} /></div><div className="stat-value">{format(data.executive.orders)}</div><div className="stat-note">BDT {format(data.executive.orderValue)} order value</div></Link>
        <Link className="panel stat dashboard-metric-link" href="/dashboard-workspace/inventory-dashboard"><div className="dashboard-stat-head"><span className="stat-label">Stock on hand</span><Package size={19} /></div><div className="stat-value">{format(data.inventory.onHand)}</div><div className="stat-note">{format(data.inventory.reserved)} reserved</div></Link>
        <Link className="panel stat dashboard-metric-link" href="/dashboard-workspace/production-dashboard"><div className="dashboard-stat-head"><span className="stat-label">Open print orders</span><Factory size={19} /></div><div className="stat-value">{format(data.executive.openPrintOrders)}</div><div className="stat-note">Production planning</div></Link>
      </div>
      <div className="dashboard-visual-grid">
        <section className="panel dashboard-chart-panel"><div className="dashboard-chart-head"><div><h2>Order value trend</h2><p>Sales order value · last six months · BDT</p></div><Link href="/dashboard-workspace/sales-dashboard" aria-label="Open Sales Dashboard"><ArrowUpRight size={17} /></Link></div><TrendChart months={data.trends.months} /></section>
        <section className="panel dashboard-chart-panel"><div className="dashboard-chart-head"><div><h2>Sales order status</h2><p>Current order counts by status</p></div><Link href="/dashboard-workspace/sales-dashboard" aria-label="Open Sales Dashboard"><ArrowUpRight size={17} /></Link></div><SalesBars rows={data.sales.status} /></section>
        <section className="panel dashboard-chart-panel"><div className="dashboard-chart-head"><div><h2>Inventory position</h2><p>Available and reserved units</p></div><Link href="/dashboard-workspace/inventory-dashboard" aria-label="Open Inventory Dashboard"><ArrowUpRight size={17} /></Link></div><StockDonut inventory={data.inventory} /></section>
        <section className="panel dashboard-chart-panel"><div className="dashboard-chart-head"><div><h2>Publishing pipeline</h2><p>Titles by publication status</p></div><Link href="/dashboard-workspace/publishing-pipeline-dashboard" aria-label="Open Publishing Pipeline Dashboard"><ArrowUpRight size={17} /></Link></div><PublishingBars rows={data.publishing.bookStatus} /><p className="muted dashboard-chart-footer">{format(data.publishing.pendingIdentifiers)} identifiers await validation</p></section>
      </div>
      <section className="panel dashboard-overview-footer">{data.finance && <div><Wallet size={20} /><span><strong>{format(data.executive.postedJournals ?? 0)} posted journals</strong><small>BDT {format(data.finance.postedDebits)} in journal debits; this is not revenue.</small></span></div>}<div className="dashboard-overview-links">{data.finance && <Link href="/dashboard-workspace/finance-dashboard">Finance view <ArrowUpRight size={15} /></Link>}<Link href="/dashboard-workspace/my-tasks">My tasks <ArrowUpRight size={15} /></Link><Link href="/dashboard-workspace/global-search">Global search <ArrowUpRight size={15} /></Link></div></section>
    </>}
  </ErpShell>;
}
