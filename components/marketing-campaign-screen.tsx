"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Campaign = { id: string; campaign_code: string; name: string; campaign_type: string; objective: string; description: string | null; primary_channel: string; timezone: string; start_date: string; end_date: string; owner_id: string; owner_name?: string; book_id: string | null; edition_id: string | null; book_title?: string | null; edition_code?: string | null; planned_budget: string; target_leads: number | null; status: string; version_no: number; created_by: string };
type History = { action: string; from_status: string | null; to_status: string | null; reason: string | null; actor_name: string; occurred_at: string };
type Option = { id: string; display_name?: string; title?: string; book_id?: string; edition_code?: string; edition_number?: string };
type Form = { code: string; name: string; type: string; objective: string; description: string; primaryChannel: string; timezone: string; startDate: string; endDate: string; ownerId: string; bookId: string; editionId: string; plannedBudget: string; targetLeads: string };
const fresh = (): Form => ({ code: '', name: '', type: 'book_launch', objective: '', description: '', primaryChannel: 'retail', timezone: 'Asia/Dhaka', startDate: '', endDate: '', ownerId: '', bookId: '', editionId: '', plannedBudget: '0', targetLeads: '' });
const types = ['book_launch', 'edition_launch', 'reprint', 'author', 'imprint', 'book_fair', 'education', 'institutional', 'retail', 'wholesale', 'distributor', 'online', 'seasonal', 'festival', 'discount', 'bundle', 'coupon', 'email', 'sms', 'social', 'offline', 'event', 'other'];
const channels = ['retail', 'wholesale', 'distributor', 'institutional', 'ecommerce', 'book_fair', 'email', 'sms', 'social', 'offline', 'other'];
const statuses = ['draft', 'submitted', 'approved', 'rejected', 'scheduled', 'active', 'paused', 'completed', 'cancelled'];
const title = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
const date = (s?: string | null) => s ? s.slice(0, 10) : '—';

export function MarketingCampaignScreen({ screen }: { screen: Screen }) {
  const isForm = screen.title === 'Create Campaign';
  const isApproval = screen.title === 'Campaign Budget Approval';
  const isCalendar = screen.title === 'Release Calendar';
  const [rows, setRows] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(isApproval ? 'submitted' : '');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<{ campaign: Campaign; history: History[] } | null>(null);
  const [users, setUsers] = useState<Option[]>([]);
  const [books, setBooks] = useState<Option[]>([]);
  const [editions, setEditions] = useState<Option[]>([]);
  const [me, setMe] = useState<{ userId: string; role: string; permissions: string[] } | null>(null);
  const [form, setForm] = useState<Form>(fresh);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [calendarFrom, setCalendarFrom] = useState('');
  const [calendarTo, setCalendarTo] = useState('');
  const canManage = me?.role === 'Owner' || Boolean(me?.permissions.includes('marketing.manage'));
  const canApprove = me?.role === 'Owner' || Boolean(me?.permissions.includes('marketing.approve'));
  const selected = detail?.campaign.id === selectedId ? detail.campaign : null;
  const editionOptions = editions.filter(item => Boolean(form.bookId) && item.book_id === form.bookId);

  async function loadRows() {
    const params = new URLSearchParams({ q: search, limit: isCalendar ? '100' : '25', offset: String(isCalendar ? 0 : page * 25) });
    if (status) params.set('status', status);
    const result = await api<{ data: Campaign[]; meta: { total: number } }>(`/marketing/campaigns?${params}`);
    setRows(result.data); setTotal(result.meta.total);
  }
  async function loadDetail(id: string) {
    const result = await api<{ data: { campaign: Campaign; history: History[] } }>(`/marketing/campaigns/${id}`);
    setDetail(result.data);
    const c = result.data.campaign;
    setForm({ code: c.campaign_code, name: c.name, type: c.campaign_type, objective: c.objective, description: c.description || '', primaryChannel: c.primary_channel, timezone: c.timezone, startDate: date(c.start_date), endDate: date(c.end_date), ownerId: c.owner_id, bookId: c.book_id || '', editionId: c.edition_id || '', plannedBudget: String(c.planned_budget), targetLeads: c.target_leads == null ? '' : String(c.target_leads) });
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('campaign');
    if (id) setSelectedId(id);
    void Promise.all([api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me'), api<{ data: { users: Option[]; books: Option[]; editions: Option[] } }>('/marketing/options')]).then(([user, options]) => { setMe(user.data); setUsers(options.data.users); setBooks(options.data.books); setEditions(options.data.editions); }).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load campaign options')).finally(() => setLoading(false));
  }, []);
  useEffect(() => { void loadRows().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load campaigns')); }, [page, search, status]);
  useEffect(() => { if (!selectedId) { setDetail(null); setForm(fresh()); return; } void loadDetail(selectedId).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load campaign')); }, [selectedId]);
  async function act(operation: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); await loadRows(); if (selectedId) await loadDetail(selectedId); setNotice(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  function payload() { return { ...form, description: form.description || null, bookId: form.bookId || null, editionId: form.editionId || null, targetLeads: form.targetLeads === '' ? null : Number(form.targetLeads) }; }
  async function save() {
    await act(async () => { const result = await api<{ data: { id: string } }>(selected ? `/marketing/campaigns/${selected.id}` : '/marketing/campaigns', { method: selected ? 'PATCH' : 'POST', body: JSON.stringify(selected ? { ...payload(), version: selected.version_no } : payload()) }); if (!selected) setSelectedId(result.data.id); }, selected ? 'Campaign plan updated' : 'Campaign draft created');
  }
  async function transition(next: string) {
    if (!selected) return;
    await act(async () => { await api(`/marketing/campaigns/${selected.id}/${['approved','rejected'].includes(next) ? 'review' : 'transition'}`, { method: 'POST', body: JSON.stringify({ version: selected.version_no, status: next, reason: reason || null }) }); setReason(''); }, `Campaign moved to ${title(next)}`);
  }
  const selector = <section className="panel catalog-form"><div className="button-row"><input className="input" aria-label="Search campaigns" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search campaign code or name" /><button className="btn" onClick={() => { setPage(0); setSearch(searchInput); }}>Search</button>{!isCalendar && <select className="input" aria-label="Campaign status" value={status} onChange={event => { setPage(0); setStatus(event.target.value); }}><option value="">All statuses</option>{statuses.map(item => <option key={item} value={item}>{title(item)}</option>)}</select>}</div><label className="field">Campaign<select className="input" value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">{isForm ? 'Create new campaign' : 'Select campaign'}</option>{selected && !rows.some(item => item.id === selected.id) && <option value={selected.id}>{selected.campaign_code} — {selected.name}</option>}{rows.map(item => <option key={item.id} value={item.id}>{item.campaign_code} — {item.name}</option>)}</select></label></section>;
  const history = selected && <section className="panel catalog-form"><h2 className="section-title">Approval history</h2>{detail?.history.length ? detail.history.map((item, index) => <p key={`${item.occurred_at}-${index}`}>{item.occurred_at.slice(0, 19)} · {title(item.action)} · {item.from_status || 'new'} → {item.to_status || '—'} · {item.actor_name}{item.reason ? ` · ${item.reason}` : ''}</p>) : <p className="muted">No campaign actions recorded.</p>}</section>;
  return <><div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{isCalendar ? 'Scheduled dates from real campaign plans.' : isApproval ? 'Independently review proposed campaign budgets and plans.' : isForm ? 'Prepare a campaign plan before approval and execution.' : 'Search registered campaigns and inspect their lifecycle.'}</p></div><button className="btn" onClick={() => void loadRows().catch(cause => setError(cause instanceof Error ? cause.message : 'Refresh failed'))}>Refresh</button></div>{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}{loading && <div className="panel empty">Loading campaigns...</div>}
    {selector}
    {isCalendar && <section className="panel catalog-form"><div className="button-row"><label className="field">From<input className="input" type="date" value={calendarFrom} onChange={event => setCalendarFrom(event.target.value)} /></label><label className="field">To<input className="input" type="date" value={calendarTo} onChange={event => setCalendarTo(event.target.value)} /></label></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Start</th><th>End</th><th>Campaign</th><th>Channel</th><th>Book</th><th>Status</th></tr></thead><tbody>{rows.filter(item => (!calendarFrom || date(item.end_date) >= calendarFrom) && (!calendarTo || date(item.start_date) <= calendarTo)).map(item => <tr key={item.id}><td>{date(item.start_date)}</td><td>{date(item.end_date)}</td><td><button className="btn" onClick={() => setSelectedId(item.id)}>{item.campaign_code} — {item.name}</button></td><td>{title(item.primary_channel)}</td><td>{item.book_title || 'Brand campaign'}</td><td>{title(item.status)}</td></tr>)}</tbody></table></div><p className="muted">Showing up to 100 campaign plans. Draft dates are plans, not public release confirmations.</p></section>}
    {!isForm && !isCalendar && <><section className="panel table-wrap"><table className="data-table"><thead><tr><th>Campaign</th><th>Type</th><th>Channel</th><th>Dates</th><th>Owner</th><th>Planned budget</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map(item => <tr key={item.id}><td>{item.campaign_code} — {item.name}</td><td>{title(item.campaign_type)}</td><td>{title(item.primary_channel)}</td><td>{date(item.start_date)} to {date(item.end_date)}</td><td>{item.owner_name || 'Unassigned'}</td><td>{item.planned_budget} BDT</td><td>{title(item.status)}</td><td><button className="btn" onClick={() => setSelectedId(item.id)}>Review</button></td></tr>) : <tr><td colSpan={8} className="empty">No campaigns found.</td></tr>}</tbody></table></section><div className="button-row"><button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>{total} campaigns · page {page + 1}</span><button className="btn" disabled={(page + 1) * 25 >= total} onClick={() => setPage(page + 1)}>Next</button></div></>}
    {isForm && <section className="panel catalog-form"><h2 className="section-title">{selected ? `Edit ${selected.campaign_code}` : 'New campaign plan'}</h2><div className="catalog-form-grid"><label className="field">Campaign code<input className="input" value={form.code} disabled={!canManage} onChange={event => setForm({ ...form, code: event.target.value })} /></label><label className="field">Name<input className="input" value={form.name} disabled={!canManage} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="field">Campaign type<select className="input" value={form.type} disabled={!canManage} onChange={event => setForm({ ...form, type: event.target.value })}>{types.map(item => <option key={item} value={item}>{title(item)}</option>)}</select></label><label className="field">Primary channel<select className="input" value={form.primaryChannel} disabled={!canManage} onChange={event => setForm({ ...form, primaryChannel: event.target.value })}>{channels.map(item => <option key={item} value={item}>{title(item)}</option>)}</select></label><label className="field">Owner<select className="input" value={form.ownerId} disabled={!canManage} onChange={event => setForm({ ...form, ownerId: event.target.value })}><option value="">Select owner</option>{users.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label><label className="field">Book<select className="input" value={form.bookId} disabled={!canManage} onChange={event => setForm({ ...form, bookId: event.target.value, editionId: '' })}><option value="">Brand or channel campaign</option>{books.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="field">Edition<select className="input" value={form.editionId} disabled={!canManage} onChange={event => setForm({ ...form, editionId: event.target.value })}><option value="">No edition</option>{editionOptions.map(item => <option key={item.id} value={item.id}>{item.edition_code || item.edition_number}</option>)}</select></label><label className="field">Timezone<input className="input" value={form.timezone} disabled={!canManage} onChange={event => setForm({ ...form, timezone: event.target.value })} /></label><label className="field">Start date<input className="input" type="date" value={form.startDate} disabled={!canManage} onChange={event => setForm({ ...form, startDate: event.target.value })} /></label><label className="field">End date<input className="input" type="date" value={form.endDate} disabled={!canManage} onChange={event => setForm({ ...form, endDate: event.target.value })} /></label><label className="field">Planned budget (BDT)<input className="input" type="number" min="0" step="0.01" value={form.plannedBudget} disabled={!canManage} onChange={event => setForm({ ...form, plannedBudget: event.target.value })} /></label><label className="field">Target leads<input className="input" type="number" min="0" step="1" value={form.targetLeads} disabled={!canManage} onChange={event => setForm({ ...form, targetLeads: event.target.value })} /></label></div><label className="field">Objective<textarea className="input" value={form.objective} disabled={!canManage} onChange={event => setForm({ ...form, objective: event.target.value })} /></label><label className="field">Description<textarea className="input" value={form.description} disabled={!canManage} onChange={event => setForm({ ...form, description: event.target.value })} /></label>{canManage && (!selected || ['draft','rejected'].includes(selected.status)) && <button className="btn btn-primary" disabled={busy || !form.code.trim() || !form.name.trim() || !form.objective.trim() || !form.ownerId || !form.startDate || !form.endDate} onClick={() => void save()}>{selected ? 'Save campaign' : 'Create draft'}</button>}</section>}
    {selected && <section className="panel catalog-form"><h2 className="section-title">{selected.campaign_code} — {selected.name}</h2><p>{selected.objective}</p><p>Status: {title(selected.status)} · Planned budget: {selected.planned_budget} BDT · Target leads: {selected.target_leads ?? 'Not set'}. Planned amounts are not recorded expenses.</p><div className="button-row"><Link className="btn" href={`/marketing-promotions/create-campaign?campaign=${selected.id}`}>Open campaign plan</Link></div>{!isCalendar && <><label className="field">Decision reason<input className="input" value={reason} onChange={event => setReason(event.target.value)} placeholder="Required for rejection or cancellation" /></label><div className="button-row">{canManage && ['draft','rejected'].includes(selected.status) && <button className="btn btn-primary" disabled={busy} onClick={() => void transition('submitted')}>Submit for approval</button>}{canApprove && selected.status === 'submitted' && selected.created_by !== me?.userId && <><button className="btn btn-primary" disabled={busy} onClick={() => void transition('approved')}>Approve plan and budget</button><button className="btn" disabled={busy || !reason.trim()} onClick={() => void transition('rejected')}>Reject</button></>}{canManage && selected.status === 'approved' && <button className="btn" disabled={busy} onClick={() => void transition('scheduled')}>Mark scheduled</button>}{canManage && ['draft','rejected','approved','scheduled'].includes(selected.status) && <button className="btn" disabled={busy || !reason.trim()} onClick={() => void transition('cancelled')}>Cancel</button>}</div></>}</section>}
    {history}
  </>;
}
