"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Customer = { id: string; customer_code: string; name: string; status: string };
type History = { customer: Customer & { customer_type: string; credit_limit: string }; orders: Array<{ id: string; order_number: string; order_date: string; status: string; total_amount: string; currency_code: string; quotation_number: string | null }>; invoices: Array<{ id: string; invoice_number: string; invoice_date: string; status: string; total_amount: string; currency_code: string; dispatched_copies: string }>; returns: Array<{ id: string; return_number: string; return_date: string; status: string; invoice_number: string | null }>; truncated: { orders: boolean; invoices: boolean; returns: boolean } };

export function SalesCustomerHistoryScreen({ screen }: { screen: Screen }) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState<History | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const customerId = new URLSearchParams(window.location.search).get('customer');
    if (customerId && /^[0-9a-f-]{36}$/i.test(customerId)) setSelectedId(customerId);
  }, []);
  async function search() {
    setBusy(true); setError('');
    try { setCustomers((await api<{ data: Customer[] }>(`/sales/customers/options?q=${encodeURIComponent(query.trim())}`)).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not search customers'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void api<{ data: Customer[] }>('/sales/customers/options').then(result => setCustomers(result.data)).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load customers')); }, []);
  useEffect(() => {
    if (!selectedId) return;
    let active = true; setBusy(true); setError(''); setHistory(null);
    void api<{ data: History }>(`/sales/customers/${selectedId}/history`).then(result => { if (active) setHistory(result.data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load customer history'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [selectedId]);
  return <>
    <div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">Review actual Sales orders, invoice sources, posted inventory dispatch quantities and return requests by customer.</p></div></div>
    <section className="panel catalog-form"><div className="catalog-form-grid"><label className="field">Search customers<input className="input" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void search(); }} /></label><label className="field">Customer<select className="input" value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">Select customer</option>{history && !customers.some(row => row.id === history.customer.id) && <option value={history.customer.id}>{history.customer.customer_code} - {history.customer.name} ({history.customer.status})</option>}{customers.map(row => <option key={row.id} value={row.id}>{row.customer_code} - {row.name} ({row.status})</option>)}</select></label></div><button className="btn" disabled={busy} onClick={() => void search()}>Search</button></section>
    {error && <p className="alert-error" role="alert">{error}</p>}{busy && <div className="panel empty">Loading customer history...</div>}
    {history && <><section className="panel catalog-form"><h2 className="section-title">{history.customer.name}</h2><p>{history.customer.customer_code} - {history.customer.customer_type} - {history.customer.status}</p><p>Configured credit limit: {history.customer.credit_limit} BDT. Available credit is not calculated until posted AR and receipt allocations are connected.</p></section>
      <section className="panel catalog-form"><h2 className="section-title">Sales orders</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Date</th><th>Source quotation</th><th>Status</th><th>Total</th></tr></thead><tbody>{history.orders.length ? history.orders.map(row => <tr key={row.id}><td><Link href={`/sales-distribution/sales-order-detail?order=${row.id}`}>{row.order_number}</Link></td><td>{String(row.order_date).slice(0, 10)}</td><td>{row.quotation_number || 'Manual'}</td><td>{row.status}</td><td>{row.total_amount} {row.currency_code}</td></tr>) : <tr><td colSpan={5} className="empty">No Sales orders for this customer.</td></tr>}</tbody></table></div>{history.truncated.orders && <p className="muted">Showing the latest 100 orders.</p>}</section>
      <section className="panel catalog-form"><h2 className="section-title">Invoice sources and dispatch</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Date</th><th>Source status</th><th>Total</th><th>Posted dispatch copies</th></tr></thead><tbody>{history.invoices.length ? history.invoices.map(row => <tr key={row.id}><td>{row.invoice_number}</td><td>{String(row.invoice_date).slice(0, 10)}</td><td>{row.status}</td><td>{row.total_amount} {row.currency_code}</td><td>{row.dispatched_copies}</td></tr>) : <tr><td colSpan={5} className="empty">No invoice sources for this customer.</td></tr>}</tbody></table></div>{history.truncated.invoices && <p className="muted">Showing the latest 100 invoice sources.</p>}</section>
      <section className="panel catalog-form"><h2 className="section-title">Sales returns</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Return</th><th>Date</th><th>Source invoice</th><th>Status</th></tr></thead><tbody>{history.returns.length ? history.returns.map(row => <tr key={row.id}><td>{row.return_number}</td><td>{row.return_date ? String(row.return_date).slice(0, 10) : 'Not dated'}</td><td>{row.invoice_number || 'None'}</td><td>{row.status}</td></tr>) : <tr><td colSpan={4} className="empty">No Sales returns for this customer.</td></tr>}</tbody></table></div>{history.truncated.returns && <p className="muted">Showing the latest 100 Sales returns.</p>}</section>
      <p className="muted">Customer receipt allocation and a unified order-to-invoice link are pending. Invoice status here is the source status, not proof of AR posting or payment.</p></>}
  </>;
}
