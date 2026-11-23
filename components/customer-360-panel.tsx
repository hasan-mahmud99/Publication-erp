"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Contact = { id: string; name: string; role_name: string | null; email: string | null; phone: string | null; status: string };
type Address = { id: string; address_type: string; line1: string; city: string | null; district: string | null; is_default: number | boolean };
type Activity = { id: string; activity_type: string; summary: string; occurred_at: string; author_name: string };
type Case = { id: string; case_type: string; subject: string; status: string };
type Opportunity = { id: string; title: string; stage: string; expected_value: string };
type History = { orders: Array<{ id: string; order_number: string; order_date: string; status: string; total_amount: string }>; invoices: Array<{ id: string; invoice_number: string; invoice_date: string; status: string; total_amount: string; dispatched_copies: string }>; returns: Array<{ id: string; return_number: string; return_date: string; status: string; invoice_number: string | null }>; truncated: { orders: boolean; invoices: boolean; returns: boolean } };
type Props = { customerId: string; name: string; code: string; type: string; status: string; creditLimit: string; contacts: Contact[]; addresses: Address[]; activities: Activity[]; cases: Case[]; opportunities: Opportunity[]; canViewSales: boolean; canUpdate: boolean };
type Preferences = { emailOptIn: boolean; smsOptIn: boolean; phoneOptIn: boolean; version: number; configured: boolean };
const formatDate = (value: string) => String(value).slice(0, 10);

export function Customer360Panel({ customerId, name, code, type, status, creditLimit, contacts, addresses, activities, cases, opportunities, canViewSales, canUpdate }: Props) {
  const [tab, setTab] = useState<'overview' | 'contacts' | 'sales' | 'returns' | 'activities' | 'preferences'>('overview');
  const [history, setHistory] = useState<History | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [preferencesNotice, setPreferencesNotice] = useState('');
  const [loading, setLoading] = useState(canViewSales);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!canViewSales) { setHistory(null); setLoading(false); return; }
    let active = true; setLoading(true); setError('');
    void api<{ data: History }>(`/sales/customers/${customerId}/history`).then(result => { if (active) setHistory(result.data); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load Sales history'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId, canViewSales]);
  useEffect(() => {
    void api<{ data: Preferences }>(`/customers/${customerId}/communication-preferences`).then(result => setPreferences(result.data)).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load communication preferences'));
  }, [customerId]);
  async function savePreferences() {
    if (!preferences) return;
    setPreferencesBusy(true); setError(''); setPreferencesNotice('');
    try { const result = await api<{ data: Preferences }>(`/customers/${customerId}/communication-preferences`, { method: 'PUT', body: JSON.stringify({ version: preferences.version, emailOptIn: preferences.emailOptIn, smsOptIn: preferences.smsOptIn, phoneOptIn: preferences.phoneOptIn }) }); setPreferences(result.data); setPreferencesNotice('Communication preferences saved'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save communication preferences'); }
    finally { setPreferencesBusy(false); }
  }
  return <section className="panel catalog-form"><h2 className="section-title">Customer 360 · {code}</h2><p>{name} · {type} · {status}</p><div className="button-row">{(['overview','contacts','sales','returns','activities','preferences'] as const).map(value => <button key={value} className={tab === value ? 'btn btn-primary' : 'btn'} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    {tab === 'preferences' && <><h3>Communication preferences</h3><p className="muted">No channel is considered opted in until an authorized user records it. These choices do not send messages.</p>{preferencesNotice && <p className="alert-success" role="status">{preferencesNotice}</p>}{!preferences ? <p>Loading preferences...</p> : <><p>{preferences.configured ? 'Preferences recorded' : 'No preferences recorded; all channels are opted out by default.'}</p><div className="catalog-form-grid"><label className="field"><input type="checkbox" checked={preferences.emailOptIn} disabled={!canUpdate} onChange={event => setPreferences({ ...preferences, emailOptIn: event.target.checked })} /> Email opt-in</label><label className="field"><input type="checkbox" checked={preferences.smsOptIn} disabled={!canUpdate} onChange={event => setPreferences({ ...preferences, smsOptIn: event.target.checked })} /> SMS opt-in</label><label className="field"><input type="checkbox" checked={preferences.phoneOptIn} disabled={!canUpdate} onChange={event => setPreferences({ ...preferences, phoneOptIn: event.target.checked })} /> Phone opt-in</label></div>{canUpdate && <button className="btn btn-primary" disabled={preferencesBusy} onClick={() => void savePreferences()}>Save preferences</button>}</>}</>}
    {tab === 'overview' && <div className="catalog-report-grid"><div><h3>Relationship</h3><p>{contacts.length} contacts · {addresses.length} addresses</p><p>{cases.filter(item => item.status !== 'closed').length} active cases · {opportunities.filter(item => !['won','lost'].includes(item.stage)).length} open opportunities</p><p>Configured credit limit: {creditLimit} BDT</p><p className="muted">Available credit and receivables are not calculated here because source invoices are not posted to AR.</p></div><div><h3>Recent work</h3>{activities.slice(0, 5).map(item => <p key={item.id}>{formatDate(item.occurred_at)} · {item.activity_type} · {item.summary}</p>)}{!activities.length && <p className="muted">No activities recorded.</p>}{cases.slice(0, 3).map(item => <p key={item.id}>{item.case_type} · {item.subject} · {item.status}</p>)}</div></div>}
    {tab === 'contacts' && <div className="catalog-report-grid"><div><h3>Contacts</h3>{contacts.map(item => <p key={item.id}>{item.name} · {item.role_name || 'Contact'} · {item.email || item.phone || 'No contact detail'} · {item.status}</p>)}{!contacts.length && <p className="muted">No contacts recorded.</p>}</div><div><h3>Addresses</h3>{addresses.map(item => <p key={item.id}>{item.address_type} · {item.line1}{item.city ? `, ${item.city}` : ''}{item.is_default ? ' · default' : ''}</p>)}{!addresses.length && <p className="muted">No addresses recorded.</p>}</div><Link className="btn" href={`/crm-customers/customer-contacts-and-addresses?customer=${customerId}`}>Manage contacts and addresses</Link></div>}
    {tab === 'sales' && <>{!canViewSales ? <p className="muted">Sales history requires Sales read permission.</p> : loading ? <p>Loading Sales history...</p> : error ? <p className="alert-error" role="alert">{error}</p> : <><h3>Sales orders</h3>{history?.orders.map(item => <p key={item.id}>{item.order_number} · {formatDate(item.order_date)} · {item.status} · source total {item.total_amount} BDT</p>)}{!history?.orders.length && <p className="muted">No Sales orders recorded.</p>}<h3>Invoice sources</h3>{history?.invoices.map(item => <p key={item.id}>{item.invoice_number} · {formatDate(item.invoice_date)} · {item.status} · source total {item.total_amount} BDT · {item.dispatched_copies} dispatched copies</p>)}{!history?.invoices.length && <p className="muted">No invoice sources recorded.</p>}{history?.truncated.invoices && <p className="muted">Only the 100 most recent invoice sources are shown.</p>}<p className="muted">Source totals are not paid revenue or outstanding receivables.</p><Link className="btn" href={`/sales-distribution/customer-order-history?customer=${customerId}`}>Open full Sales history</Link></>}</>}
    {tab === 'returns' && <>{!canViewSales ? <p className="muted">Returns history requires Sales read permission.</p> : loading ? <p>Loading returns...</p> : error ? <p className="alert-error" role="alert">{error}</p> : <>{history?.returns.map(item => <p key={item.id}>{item.return_number} · {formatDate(item.return_date)} · {item.status} · invoice {item.invoice_number || 'unreferenced'}</p>)}{!history?.returns.length && <p className="muted">No returns recorded.</p>}{history?.truncated.returns && <p className="muted">Only the 100 most recent returns are shown.</p>}</>}</>}
    {tab === 'activities' && <><h3>Activities</h3>{activities.map(item => <p key={item.id}>{formatDate(item.occurred_at)} · {item.activity_type} · {item.summary} · {item.author_name}</p>)}{!activities.length && <p className="muted">No activities recorded.</p>}<h3>Opportunities</h3>{opportunities.map(item => <p key={item.id}>{item.title} · {item.stage} · expected {item.expected_value} BDT</p>)}{!opportunities.length && <p className="muted">No opportunities recorded.</p>}</>}
  </section>;
}
