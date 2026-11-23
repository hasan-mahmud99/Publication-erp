"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type StatusRow = { status: string; total: number | string; order_value?: string; planned_qty?: number | string };
type SearchHit = { type: string; title: string; detail: string; status?: string; updatedAt?: string; path: string };
type Task = { entity_id: string; kind: string; created_at: string | null };
const screenPaths: Record<string, string> = {
  'Executive Dashboard': 'executive',
  'Publishing Pipeline Dashboard': 'publishing',
  'Sales Dashboard': 'sales',
  'Inventory Dashboard': 'inventory',
  'Production Dashboard': 'production',
  'Finance Dashboard': 'finance',
  'My Tasks': 'tasks',
  'Global Search': 'search',
};
const dateScope: Record<string, string> = {
  executive: 'Dates apply to sales orders, posted invoices, posted journals and accessible manuscripts. Catalog, production and stock show current totals.',
  publishing: 'Dates apply to manuscript receipt and book creation. Edition status and identifier queue show current totals.',
  sales: 'Dates apply to orders and posted invoices. Active customers show the current total.',
  production: 'Dates apply to the schedule and status groups. Due in 14 days always uses today.',
  finance: 'Dates apply to journals. Open fiscal periods show the current total.',
};
const date = (value: unknown) => value ? String(value).slice(0, 10) : '—';
const number = (value: unknown) => Number(value || 0).toLocaleString('en-BD', { maximumFractionDigits: 2 });
type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'last' | 'quarter' | 'year';
const datePresets: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' }, { key: 'month', label: 'This month' },
  { key: 'last', label: 'Last month' }, { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'This year' },
];
function dhakaToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function presetDates(name: DatePreset, today: string): { from: string; to: string } {
  const [year, month] = today.split('-').map(Number);
  if (name === 'today') return { from: today, to: today };
  if (name === 'yesterday' || name === 'week') {
    const day = new Date(`${today}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - (name === 'yesterday' ? 1 : (day.getUTCDay() + 6) % 7));
    const from = day.toISOString().slice(0, 10);
    return { from, to: name === 'yesterday' ? from : today };
  }
  if (name === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (name === 'year') return { from: `${year}-01-01`, to: today };
  if (name === 'quarter') return { from: `${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0')}-01`, to: today };
  return { from: new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7) + '-01', to: new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10) };
}
const taskPath = (kind: string) => {
  if (kind.includes('Stock count')) return '/inventory-warehouse/physical-stock-count';
  if (kind.includes('journal') || kind.includes('Journal')) return '/finance-accounting/journal-voucher-list';
  if (kind.includes('movement')) return '/inventory-warehouse/inventory-transaction-ledger';
  if (kind.includes('Identifier')) return '/publishing-catalog/identifier-validation-queue';
  return '/crm-customers/complaints-and-disputes';
};
function StatusGrid({ rows, valueKey = 'total', label = 'Records' }: { rows: StatusRow[]; valueKey?: 'total' | 'order_value' | 'planned_qty'; label?: string }) {
  return <div className="stat-grid">{rows.length ? rows.map(row => <div className="panel stat" key={row.status}><div className="stat-label">{row.status.replaceAll('_', ' ')}</div><div className="stat-value">{number(row[valueKey])}</div><div className="stat-note">{label}</div></div>) : <div className="panel empty">No records for this period.</div>}</div>;
}
function Metric({ label, value, note, href }: { label: string; value: string | number; note: string; href?: string }) {
  const content = <><div className="stat-label">{label}</div><div className="stat-value">{number(value)}</div><div className="stat-note">{note}</div></>;
  return href ? <Link className="panel stat dashboard-metric-link" href={href}>{content}</Link> : <div className="panel stat">{content}</div>;
}
function Bars({ title, rows, labelKey, valueKey, unit }: { title: string; rows: any[]; labelKey: string; valueKey: string; unit?: string }) {
  const maximum = Math.max(0, ...rows.map(row => Number(row[valueKey] || 0)));
  return <section className="panel dashboard-chart-panel"><div className="dashboard-chart-head"><div><h2>{title}</h2><p>{unit || ''}</p></div></div>{rows.length ? <div className="dashboard-horizontal-bars">{rows.map((row, index) => <div className="dashboard-horizontal-row" key={`${row[labelKey]}-${index}`}><div><span>{String(row[labelKey]).replaceAll('_', ' ')}</span><strong>{number(row[valueKey])} {unit}</strong></div><div className="dashboard-horizontal-track"><div style={{ width: `${maximum > 0 ? Math.max(0, Number(row[valueKey])) / maximum * 100 : 0}%` }} /></div></div>)}</div> : <p className="empty">No records for this period.</p>}</section>;
}
function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  return index < 0 ? <>{text}</> : <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

export function DashboardScreen({ screen }: { screen: Screen }) {
  const kind = screenPaths[screen.title];
  const t = (value: string) => value;
  const [response, setResponse] = useState<{ kind: string; payload: any } | null>(null);
  const data = response?.kind === kind ? response.payload : null;
  const requestId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('from') || '');
  const [to, setTo] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('to') || '');
  const [appliedFrom, setAppliedFrom] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('from') || '');
  const [appliedTo, setAppliedTo] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('to') || '');
  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('categoryId') || '');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [taskStatus, setTaskStatus] = useState('open');
  const [page, setPage] = useState(0);
  const [validation, setValidation] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset | null>(null);
  function applyDates(start: string, end: string, presetKey: DatePreset | null = null) {
    if (start && end && start > end) { setValidation(t('Select a date range in the correct order.')); return; }
    setValidation(''); setFrom(start); setTo(end); setAppliedFrom(start); setAppliedTo(end); setPage(0); setSelectedPreset(presetKey); setRefreshKey(value => value + 1);
    const url = new URL(window.location.href);
    if (start) url.searchParams.set('from', start); else url.searchParams.delete('from');
    if (end) url.searchParams.set('to', end); else url.searchParams.delete('to');
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  }
  function preset(name: DatePreset) { const range = presetDates(name, dhakaToday()); applyDates(range.from, range.to, name); }
  async function load() {
    const currentRequest = ++requestId.current;
    if (kind === 'search' && search.length < 2) { setResponse(null); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (kind === 'search') { params.set('q', search); params.set('type', searchType); params.set('offset', String(page * 25)); }
      else if (kind === 'inventory') { if (warehouseId) params.set('warehouseId', warehouseId); params.set('offset', String(page * 20)); }
      else if (kind === 'tasks') { params.set('status', taskStatus); params.set('offset', String(page * 25)); }
      else {
        if (appliedFrom) params.set('from', appliedFrom);
        if (appliedTo) params.set('to', appliedTo);
        if (kind === 'publishing' && categoryId) params.set('categoryId', categoryId);
        if (kind !== 'executive') params.set('offset', String(page * 20));
      }
      const result = await api<{ data: any }>(`/dashboard/${kind}${params.size ? `?${params}` : ''}`);
      if (currentRequest === requestId.current) setResponse({ kind, payload: result.data });
    } catch (reason) { if (currentRequest === requestId.current) setError(reason instanceof Error ? reason.message : 'Could not load dashboard'); }
    finally { if (currentRequest === requestId.current) setLoading(false); }
  }
  useEffect(() => { setPage(0); }, [kind]);
  useEffect(() => { void load(); }, [kind, appliedFrom, appliedTo, warehouseId, categoryId, search, searchType, taskStatus, page, refreshKey]);
  const dateFilter = !['inventory', 'tasks', 'search'].includes(kind);
  const activeRange = appliedFrom || appliedTo ? `${appliedFrom || 'Any date'} to ${appliedTo || 'Any date'}` : 'All dates';
  const matchingDatedRecords = kind === 'executive' ? Number(data?.orders || 0) + Number(data?.postedInvoices?.total || 0) + Number(data?.editorial?.counts?.total || 0) + Number(data?.postedJournals || 0)
    : kind === 'publishing' ? Number(data?.bookTotal || 0) + Number(data?.manuscripts?.meta?.total || 0)
    : kind === 'sales' ? Number(data?.postedInvoices?.total || 0) + (data?.status || []).reduce((sum: number, row: StatusRow) => sum + Number(row.total || 0), 0)
    : kind === 'production' ? Number(data?.orderTotal || 0)
    : kind === 'finance' ? Number(data?.journalTotal || 0) : 0;
  const currentRangeLoaded = data?.range?.from === (appliedFrom || null) && data?.range?.to === (appliedTo || null);
  const filters = dateFilter ? <section className="panel dashboard-filter">
    <div className="catalog-form-grid"><label className="field">{t(kind === 'production' ? 'Due from' : 'From date')}<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field">{t(kind === 'production' ? 'Due to' : 'To date')}<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>{kind === 'publishing' && <label className="field">Catalog category<select className="input" value={categoryId} onChange={event => { const value = event.target.value; setCategoryId(value); setPage(0); const url = new URL(window.location.href); if (value) url.searchParams.set('categoryId', value); else url.searchParams.delete('categoryId'); window.history.replaceState(window.history.state, '', url.pathname + url.search); }}><option value="">All categories</option>{(data?.categories || []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}</div>
    <div className="button-row"><button className="btn btn-primary" onClick={() => applyDates(from, to)}>Apply dates</button><button className="btn" onClick={() => applyDates('', '')}>Clear</button>{datePresets.map(item => <button key={item.key} className={`btn dashboard-date-preset${selectedPreset === item.key ? ' is-active' : ''}`} aria-pressed={selectedPreset === item.key} onClick={() => preset(item.key)}>{item.label}</button>)}</div>
    {validation && <p className="alert-error" role="alert">{validation}</p>}<p className="dashboard-filter-applied" role="status"><strong>Active date filter:</strong> {activeRange}{loading ? ' · Updating…' : ''}</p>{!loading && currentRangeLoaded && matchingDatedRecords === 0 && <p className="dashboard-filter-empty">{appliedFrom || appliedTo ? 'No dated records match this range.' : 'No dated records have been saved yet.'} Current totals may still appear below.</p>}<p className="muted small dashboard-scope">{t(dateScope[kind])}</p>{kind === 'publishing' && <p className="muted small">Category filters catalog counts, editions, identifiers and recent books. Accessible manuscripts remain scoped by assignment and date.</p>}
  </section> : kind === 'inventory' ? <section className="panel dashboard-filter"><label className="field">{t('Warehouse')}<select className="input" value={warehouseId} onChange={event => { setWarehouseId(event.target.value); setPage(0); }}><option value="">{t('All warehouses')}</option>{(data?.warehouses || []).map((row: any) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label></section> : null;
  const pager = (total: number, size = 20) => <div className="catalog-pagination"><span>{t('Page')} {number(page + 1)} · {number(total)} {t('records')}</span><div className="button-row"><button className="btn" disabled={page === 0} onClick={() => setPage(value => value - 1)}>{t('Previous')}</button><button className="btn" disabled={(page + 1) * size >= total} onClick={() => setPage(value => value + 1)}>{t('Next')}</button></div></div>;
  let content: React.ReactNode = null;
  if (data && kind === 'executive') {
    const revenueAccount = (data.financeAccounts || []).find((row: any) => row.account_type === 'revenue');
    const postedRevenue = Number(revenueAccount?.credit || 0) - Number(revenueAccount?.debit || 0);
    content = <><div className="stat-grid">
      <Metric label="Catalog titles" value={data.books} note={number(data.activeBooks) + ' active · ' + number(data.editions) + ' editions'} href="/publishing-catalog/book-catalog-list" />
      <Metric label="Sales orders" value={data.orders} note={'BDT ' + number(data.orderValue) + ' planned order value'} href="/dashboard-workspace/sales-dashboard" />
      <Metric label="Posted invoices" value={data.postedInvoices?.total || 0} note={'BDT ' + number(data.postedInvoices?.ex_tax_amount) + ' excluding tax'} href="/dashboard-workspace/sales-dashboard" />
      <Metric label="Open print orders" value={data.openPrintOrders} note="Production planning" href="/dashboard-workspace/production-dashboard" />
      <Metric label="Stock on hand" value={data.onHand} note={number(data.reserved) + ' reserved'} href="/inventory-warehouse/inventory-overview" />
      <Metric label="Authors" value={data.authors} note="Catalog contributors" href="/publishing-catalog/book-catalog-list" />
      <Metric label="Customers" value={data.activeCustomers} note="Active profiles" href="/crm-customers/customer-profile" />
      <Metric label="Suppliers" value={data.activeSuppliers} note="Active supplier records" />
      {data.canReadEditorial && <Metric label="Manuscript stages" value={data.editorial?.counts?.total || 0} note="Accessible submissions in selected range" href="/dashboard-workspace/publishing-pipeline-dashboard" />}
      {data.canReadFinance && <Metric label="Posted revenue" value={postedRevenue} note="BDT · posted revenue accounts" href="/dashboard-workspace/finance-dashboard" />}
    </div><div className="dashboard-charts"><Bars title="Monthly invoiced sales" rows={data.invoiceMonths || []} labelKey="month" valueKey="amount" unit="BDT" />
      {data.canReadEditorial && <Bars title="Manuscript stages" rows={data.editorial?.stages || []} labelKey="status" valueKey="total" />}
    </div><section className="panel catalog-form"><h2 className="section-title">{t('Operational views')}</h2><div className="button-row"><Link href="/dashboard-workspace/publishing-pipeline-dashboard">{t('Publishing Pipeline Dashboard')}</Link><Link href="/dashboard-workspace/inventory-dashboard">{t('Inventory Dashboard')}</Link><Link href="/dashboard-workspace/my-tasks">{t('My Tasks')}</Link>{data.canReadFinance && <Link href="/dashboard-workspace/finance-dashboard">{t('Finance Dashboard')}</Link>}</div></section></>;
  } else if (data && kind === 'publishing') {
    content = <><div className="section-head"><h2 className="section-title">{t('Manuscript pipeline')}</h2>{data.canReadEditorial && <Link href="/manuscript-editorial/submission-inbox">{t('Open')}</Link>}</div>
      {data.canReadEditorial ? <><StatusGrid rows={data.editorial?.stages || []} /><Bars title="Manuscript stages" rows={data.editorial?.stages || []} labelKey="status" valueKey="total" />
        <div className="section-head"><h2 className="section-title">{t('Recent manuscripts')}</h2></div><div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Reference')}</th><th>{t('Title')}</th><th>{t('Status')}</th><th>{t('Date')}</th><th>{t('Open')}</th></tr></thead><tbody>{data.manuscripts?.data?.length ? data.manuscripts.data.map((row: any) => <tr key={row.id}><td>{row.reference_code}</td><td>{row.title}</td><td>{t(row.status)}</td><td>{date(row.received_at)}</td><td><Link href={'/manuscript-editorial/manuscript-detail?manuscript=' + row.id}>{t('Open')}</Link></td></tr>) : <tr><td colSpan={5} className="empty">{t('No records for this period.')}</td></tr>}</tbody></table></div>{pager(data.manuscripts?.meta?.total || 0)}</>
        : <div className="panel empty">{t('Editorial permission is required for manuscript details.')}</div>}
      <div className="section-head"><h2 className="section-title">{t('Titles by publication status')}</h2><Link href="/publishing-catalog/book-catalog-list">{t('Open')}</Link></div><StatusGrid rows={data.bookStatus} />
      <div className="section-head"><h2 className="section-title">{t('Editions by status')}</h2><Link href="/publishing-catalog/edition-list">{t('Open')}</Link></div><StatusGrid rows={data.editionStatus} />
      <section className="panel catalog-form"><h2 className="section-title">{t('Identifier validation queue')}</h2><p><Link href="/publishing-catalog/identifier-validation-queue">{number(data.pendingIdentifiers)} {t('identifiers awaiting validation')}</Link></p></section>
      <div className="section-head"><h2 className="section-title">{t('Recent titles')}</h2></div><div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Title')}</th><th>{t('Status')}</th><th>{t('Editions')}</th><th>{t('Date')}</th></tr></thead><tbody>{data.recentBooks.map((row: any) => <tr key={row.id}><td><Link href={'/publishing-catalog/book-detail-and-timeline?book=' + row.id}>{row.title}</Link></td><td>{t(row.publication_status)}</td><td>{row.editions}</td><td>{date(row.created_at)}</td></tr>)}</tbody></table></div></>;
  } else if (data && kind === 'sales') {
    content = <><div className="stat-grid"><Metric label="Active customers" value={data.activeCustomers} note="CRM profiles" href="/crm-customers/customer-profile" />
      <Metric label="Posted invoices" value={data.postedInvoices.total} note="Posted invoice headers only" />
      <Metric label="Invoiced sales excluding tax" value={data.postedInvoices.ex_tax_amount} note="BDT · posted total less invoice tax" />
      {data.status.map((row: StatusRow) => <Metric key={row.status} label={t(row.status) + ' orders'} value={row.total} note={'BDT ' + number(row.order_value) + ' planned order value'} />)}</div>
      <p className="muted">{t('Posted invoices are separate from sales orders. Return amounts, discounts and collections are unavailable in the current schema.')}</p>
      <Bars title="Monthly invoiced sales" rows={data.invoiceMonths || []} labelKey="month" valueKey="amount" unit="BDT" />
      <div className="section-head"><h2 className="section-title">{t('Posted invoice register')}</h2></div><div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Reference')}</th><th>{t('Customer')}</th><th>{t('Date')}</th><th>{t('Subtotal')}</th><th>{t('Tax')}</th><th>{t('Amount')}</th></tr></thead><tbody>{data.postedInvoices.rows.length ? data.postedInvoices.rows.map((row: any) => <tr key={row.id}><td>{row.invoice_number}</td><td>{row.customer_name}</td><td>{date(row.invoice_date)}</td><td>BDT {number(row.subtotal)}</td><td>BDT {number(row.tax_amount)}</td><td>BDT {number(row.total_amount)}</td></tr>) : <tr><td colSpan={6} className="empty">{t('No records for this period.')}</td></tr>}</tbody></table></div>{pager(Number(data.postedInvoices.total))}
      <div className="section-head"><h2 className="section-title">{t('Recent sales orders')}</h2></div><div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Reference')}</th><th>{t('Customer')}</th><th>{t('Date')}</th><th>{t('Status')}</th><th>{t('Amount')}</th></tr></thead><tbody>{data.recentOrders.length ? data.recentOrders.map((row: any) => <tr key={row.id}><td>{row.order_number}</td><td>{row.customer_name}</td><td>{date(row.order_date)}</td><td>{t(row.status)}</td><td>BDT {number(row.total_amount)}</td></tr>) : <tr><td colSpan={5} className="empty">{t('No records for this period.')}</td></tr>}</tbody></table></div></>;
  } else if (data && kind === 'inventory') {
    content = <><div className="stat-grid"><Metric label="On hand" value={data.onHand} note="Posted stock" href="/inventory-warehouse/stock-by-warehouse-bin" /><Metric label="Reserved" value={data.reserved} note="Committed stock" href="/inventory-warehouse/reserved-and-available-stock" /><Metric label="Available" value={data.available} note="On hand less reserved" href="/inventory-warehouse/reserved-and-available-stock" /><Metric label="Stock value" value={data.stockValue} note="BDT · weighted-average basis" href="/inventory-warehouse/inventory-valuation" /></div>
      <Bars title="Stock by warehouse" rows={data.warehouseStock || []} labelKey="name" valueKey="on_hand" unit="units" />
      <div className="catalog-report-grid"><section className="panel catalog-form"><h2 className="section-title">{t('Attention needed')}</h2><p><Link href="/inventory-warehouse/inventory-transaction-ledger">{number(data.pendingMovements)} {t('draft movements')}</Link></p><p><Link href="/inventory-warehouse/physical-stock-count">{number(data.pendingCounts)} {t('counts awaiting approval')}</Link></p><p><Link href="/inventory-warehouse/in-transit-stock">{number(data.inTransit)} {t('transfers in transit')}</Link></p></section><section className="panel catalog-form"><h2 className="section-title">{t('Warehouse scope')}</h2><p>{warehouseId ? data.warehouses.find((row: any) => row.id === warehouseId)?.name || t('Selected warehouse') : t('All warehouses')}</p><p className="muted">{t('Valuation uses current weighted-average stock cost; WIP and quarantine require separate source workflows.')}</p></section></div>
      <div className="section-head"><h2 className="section-title">{t('Stock by item')}</h2></div><div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Item')}</th><th>{t('Warehouse')}</th><th>{t('On hand')}</th><th>{t('Reserved')}</th><th>{t('Available')}</th></tr></thead><tbody>{data.topStock.length ? data.topStock.map((row: any, index: number) => <tr key={index}><td>{row.item_code} · {row.name}</td><td>{row.warehouse_code}</td><td>{number(row.on_hand_qty)}</td><td>{number(row.reserved_qty)}</td><td>{number(row.available_qty)}</td></tr>) : <tr><td colSpan={5} className="empty">{t('No records for this period.')}</td></tr>}</tbody></table></div>{pager(Number(data.stockTotal))}</>;
  } else if (data && kind === 'production') {
    content = <><div className="stat-grid"><Metric label="Due in 14 days" value={data.dueSoon} note="Open print orders" />{data.status.map((row: StatusRow) => <Metric key={row.status} label={t(row.status) + ' runs'} value={row.total} note={number(row.planned_qty) + ' planned copies'} />)}</div>
      <Bars title="Print order status" rows={data.status || []} labelKey="status" valueKey="total" />
      <p className="muted">{t('Print-order plans are shown. Actual output, QC, wastage and cost variance need production posting records that are not yet available.')}</p>
      <div className="section-head"><h2 className="section-title">{t('Production schedule')}</h2></div><div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Reference')}</th><th>{t('Book and edition')}</th><th>{t('Planned copies')}</th><th>{t('Date')}</th><th>{t('Status')}</th></tr></thead><tbody>{data.recentOrders.length ? data.recentOrders.map((row: any) => <tr key={row.id}><td><Link href={'/printing-production/print-order-detail?printOrder=' + row.id}>{row.print_order_number}</Link></td><td>{row.book_title} · {row.edition_number}</td><td>{number(row.planned_qty)}</td><td>{date(row.due_date)}</td><td>{t(row.status)}</td></tr>) : <tr><td colSpan={5} className="empty">{t('No records for this period.')}</td></tr>}</tbody></table></div>{pager(Number(data.orderTotal))}</>;
  } else if (data && kind === 'finance') {
    content = <><div className="stat-grid"><Metric label="Posted revenue" value={data.postedSummary.revenue} note="BDT · credits less debits" href="/finance-accounting/profit-and-loss-balance-sheet-cash-flow" /><Metric label="Posted expenses" value={data.postedSummary.expense} note="BDT · debits less credits" href="/finance-accounting/profit-and-loss-balance-sheet-cash-flow" /><Metric label="Net income" value={data.postedSummary.netIncome} note="BDT · revenue less expense" href="/finance-accounting/profit-and-loss-balance-sheet-cash-flow" /><Metric label="Open fiscal periods" value={data.openPeriods} note="Posting windows" href="/finance-accounting/fiscal-period-close" />{data.status.map((row: StatusRow) => <Metric key={row.status} label={t(row.status) + ' journals'} value={row.total} note="Journal entries" href="/finance-accounting/journal-voucher-list" />)}</div>
      <p className="muted">{t('Financial amounts use posted journal lines only. Receivable/payable ageing and royalty liabilities require allocation ledgers not yet implemented.')}</p>
      <Bars title="Monthly posted revenue" rows={data.monthly || []} labelKey="month" valueKey="revenue" unit="BDT" /><Bars title="Monthly posted expenses" rows={data.monthly || []} labelKey="month" valueKey="expense" unit="BDT" />
      <div className="section-head"><h2 className="section-title">{t('Recent journals')}</h2><Link href="/finance-accounting/trial-balance">{t('View trial balance')}</Link></div><div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Reference')}</th><th>{t('Date')}</th><th>{t('Description')}</th><th>{t('Status')}</th></tr></thead><tbody>{data.recentJournals.length ? data.recentJournals.map((row: any) => <tr key={row.id}><td><Link href={'/finance-accounting/journal-entry-detail?journal=' + row.id}>{row.entry_number}</Link></td><td>{date(row.posting_date)}</td><td>{row.description || '—'}</td><td>{t(row.status)}</td></tr>) : <tr><td colSpan={4} className="empty">{t('No records for this period.')}</td></tr>}</tbody></table></div>{pager(Number(data.journalTotal))}</>;
  } else if (data && kind === 'tasks') {
    const taskList = (rows: Task[]) => <div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Action')}</th><th>{t('Date')}</th><th>{t('Open')}</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.kind + row.entity_id + index}><td>{row.kind}</td><td>{date(row.created_at)}</td><td><Link href={taskPath(row.kind)}>{t('Open')}</Link></td></tr>) : <tr><td colSpan={3} className="empty">{t('No records for this period.')}</td></tr>}</tbody></table></div>;
    content = <>{data.editorialSummary && <div className="stat-grid"><Metric label="Assigned editorial tasks" value={data.editorialSummary.assigned} note="All statuses" /><Metric label="Pending editorial tasks" value={data.editorialSummary.pending} note="Open assignments" /><Metric label="Overdue editorial tasks" value={data.editorialSummary.overdue} note="Asia/Dhaka date" /><Metric label="Completed editorial tasks" value={data.editorialSummary.completed} note="Retained history" /></div>}<section className="panel dashboard-filter"><label className="field">{t('Status')}<select className="input" value={taskStatus} onChange={event => { setTaskStatus(event.target.value); setPage(0); }}><option value="open">{t('open')}</option><option value="completed">{t('completed')}</option><option value="all">{t('All')}</option></select></label></section>
      <div className="section-head"><h2 className="section-title">{t('Editorial assignments')}</h2></div><div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Reference')}</th><th>{t('Title')}</th><th>{t('Type')}</th><th>{t('Date')}</th><th>{t('Status')}</th><th>{t('Open')}</th></tr></thead><tbody>{data.editorialTasks.length ? data.editorialTasks.map((row: any) => <tr key={row.id}><td>{row.reference_code}</td><td>{row.title}</td><td>{t(row.task_type)}</td><td>{date(row.due_date)}</td><td>{t(row.status)}</td><td><Link href={'/manuscript-editorial/' + (row.task_type === 'screening' ? 'screening-queue' : row.task_type === 'review' ? 'editorial-review' : row.task_type === 'proof' ? 'proof-approval' : 'editing-and-proofreading-tracker') + '?manuscript=' + row.manuscript_id}>{t('Open')}</Link></td></tr>) : <tr><td colSpan={6} className="empty">{t('No records for this period.')}</td></tr>}</tbody></table></div>{pager(Number(data.editorialTotal), 25)}
      <p className="muted">{t('Editorial decisions are completed in their source workflow; this queue cannot bypass review approval.')}</p>
      <div className="section-head"><h2 className="section-title">{t('My open items')}</h2></div>{taskList(data.mine)}{data.canApprove && <><div className="section-head"><h2 className="section-title">{t('Approval and posting queue')}</h2></div>{taskList(data.approvals)}</>}</>;
  } else if (kind === 'search') {
    content = <><section className="panel catalog-form"><form onSubmit={event => { event.preventDefault(); setPage(0); setSearch(searchInput.trim()); }} className="button-row"><label className="field">{t('Search')}<input className="input" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={t('Search authorized ERP records')} minLength={2} required /></label><button className="btn btn-primary" type="submit">{t('Search')}</button></form>
      {data && <label className="field">{t('Type')}<select className="input" value={searchType} onChange={event => { setSearchType(event.target.value); setPage(0); }}><option value="all">{t('All types')}</option>{data.types.map((type: string) => <option key={type} value={type}>{t(type)}</option>)}</select></label>}</section>
      {data ? <><p className="muted">{number(data.meta.total)} {t('results for')} “{data.query}”.</p><div className="panel table-wrap"><table className="data-table"><thead><tr><th>{t('Type')}</th><th>{t('Title')}</th><th>{t('Details')}</th><th>{t('Status')}</th><th>{t('Date')}</th><th>{t('Open')}</th></tr></thead><tbody>{data.results.length ? data.results.map((hit: SearchHit, index: number) => <tr key={index}><td>{t(hit.type)}</td><td><Link href={hit.path}><Highlight text={hit.title} query={data.query} /></Link></td><td>{hit.detail}</td><td>{t(hit.status || '—')}</td><td>{date(hit.updatedAt)}</td><td><Link href={hit.path}>{t('Open')}</Link></td></tr>) : <tr><td colSpan={6} className="empty">{t('No matching records.')}</td></tr>}</tbody></table></div>{pager(Number(data.meta.total), 25)}</> : <div className="panel empty">{t('Enter at least two characters to search authorized records.')}</div>}</>;
  }
  return <><div className="page-heading"><div><h1 className="page-title">{screen.title}</h1></div><button className="btn" onClick={() => void load()}>Refresh</button></div>{filters}{error && <div className="alert-error" role="alert"><strong>{error.includes('Permission') ? 'Permission required' : error}</strong><button className="btn" onClick={() => void load()}>Refresh</button></div>}{loading ? <div className="panel dashboard-loading" role="status"><span></span><span></span><span></span>Loading dashboard…</div> : content}</>;
}
