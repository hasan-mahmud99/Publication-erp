"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Customer = { id: string; customer_code: string; name: string };
type Readiness = { customer: Customer; sourceInvoices: number; markedPostedInvoices: number; linkedPostedJournals: number; calculationAvailable: false; missing: string[] };

export function CrmProfitabilityScreen({ screen }: { screen: Screen }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { void api<{ data: Customer[] }>(`/customers?q=${encodeURIComponent(search)}&limit=50`).then(result => setCustomers(result.data)).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load customers')); }, [search]);
  useEffect(() => {
    if (!customerId) { setReadiness(null); return; }
    let active = true; setLoading(true); setError('');
    void api<{ data: Readiness }>(`/crm/profitability/readiness?customerId=${customerId}`).then(result => { if (active) setReadiness(result.data); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not check profitability data'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId]);
  return <><div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">Review the source and posting readiness for a customer profitability report.</p></div></div>
    {error && <p className="alert-error" role="alert">{error}</p>}
    <section className="panel catalog-form"><h2 className="section-title">Select customer</h2><div className="button-row"><input className="input" aria-label="Find customer" placeholder="Customer name or code" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} /><button className="btn" onClick={() => setSearch(searchDraft)}>Search</button></div><label className="field">Customer<select className="input" value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="">Select customer</option>{customers.map(item => <option key={item.id} value={item.id}>{item.customer_code} · {item.name}</option>)}</select></label></section>
    {loading && <div className="panel empty">Checking posted data...</div>}
    {readiness && <section className="panel catalog-form"><h2 className="section-title">{readiness.customer.customer_code} · reporting readiness</h2><div className="stat-grid"><div className="panel stat"><div className="stat-label">Invoice source records</div><div className="stat-value">{readiness.sourceInvoices}</div></div><div className="panel stat"><div className="stat-label">Invoices marked posted</div><div className="stat-value">{readiness.markedPostedInvoices}</div></div><div className="panel stat"><div className="stat-label">Linked posted journals</div><div className="stat-value">{readiness.linkedPostedJournals}</div></div></div><p className="alert-error">A customer profit amount is unavailable until revenue and cost definitions, account mapping, and journal linkage are approved and implemented. Source invoice totals are not revenue or receivables.</p><h3>Required financial configuration</h3><ul>{readiness.missing.map(item => <li key={item}>{item}</li>)}</ul></section>}
  </>;
}
