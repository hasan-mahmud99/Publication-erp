"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type CalendarRow = { edition_id: string; book_id: string; edition_number: string; format: string; publication_date: string; edition_status: string; version_no: number; book_code: string | null; title: string; publication_status: string; publisher_name: string | null };
type HistoryRow = { id: string; action: string; entity_type: string; entity_id: string; actor_name: string | null; occurred_at: string };
type HistoryDetail = HistoryRow & { metadata_json: unknown };
type QualityRow = { id: string; bookCode: string | null; title: string; status: string; score: number; missing: string[] };
type Choice = { id: string; name?: string; name_en?: string };
const day = (value: string | null | undefined) => value ? String(value).slice(0, 10) : '—';
const thisMonth = () => { const now = new Date(); const year = now.getFullYear(), month = now.getMonth() + 1; const prefix = `${year}-${String(month).padStart(2, '0')}-`; return { from: `${prefix}01`, to: `${prefix}${String(new Date(year, month, 0).getDate()).padStart(2, '0')}` }; };

export function CatalogInsightsScreen({ screen }: { screen: Screen }) {
  const isCalendar = screen.title === 'Publication Calendar';
  const isHistory = screen.title === 'Catalog Change History';
  const isQuality = screen.title === 'Book Metadata Completeness';
  const [range, setRange] = useState(thisMonth);
  const [calendar, setCalendar] = useState<CalendarRow[]>([]);
  const [calendarStatus, setCalendarStatus] = useState('');
  const [publisherId, setPublisherId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [publishers, setPublishers] = useState<Choice[]>([]);
  const [categories, setCategories] = useState<Choice[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<CalendarRow | null>(null);
  const [newReleaseDate, setNewReleaseDate] = useState('');
  const [scheduleReason, setScheduleReason] = useState('');
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyDetail, setHistoryDetail] = useState<HistoryDetail | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [quality, setQuality] = useState<QualityRow[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('');
  const [historyAction, setHistoryAction] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyReference, setHistoryReference] = useState('');
  const [historyReferenceInput, setHistoryReferenceInput] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [exportType, setExportType] = useState('books');
  const [exportCount, setExportCount] = useState<number | null>(null);
  const [exportQueryInput, setExportQueryInput] = useState('');
  const [exportQuery, setExportQuery] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [exportFormat, setExportFormat] = useState('');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function exportParams() {
    const params = new URLSearchParams({ type: exportType });
    if (exportType === 'books' || exportType === 'editions') {
      if (exportQuery) params.set('q', exportQuery);
      if (exportStatus) params.set('status', exportStatus);
      if (exportFrom) params.set('from', exportFrom);
      if (exportTo) params.set('to', exportTo);
      if (exportType === 'editions' && exportFormat) params.set('format', exportFormat);
    }
    return params;
  }
  async function load() {
    setError(''); setLoading(true);
    try {
      if (isCalendar) {
        const params = new URLSearchParams({ from: range.from, to: range.to });
        if (calendarStatus) params.set('status', calendarStatus);
        if (publisherId) params.set('publisherId', publisherId);
        if (categoryId) params.set('categoryId', categoryId);
        const result = await api<{ data: CalendarRow[] }>(`/catalog/calendar?${params}`);
        setCalendar(result.data);
      } else if (isHistory) {
        const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
        if (entityType) params.set('entityType', entityType);
        if (historyAction) params.set('action', historyAction);
        if (historyFrom) params.set('from', historyFrom);
        if (historyTo) params.set('to', historyTo);
        if (historyReference) params.set('entityId', historyReference);
        const result = await api<{ data: HistoryRow[]; meta: { total: number } }>(`/catalog/change-history?${params}`);
        setHistory(result.data); setTotal(result.meta.total);
      } else if (isQuality) {
        const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
        if (query) params.set('q', query);
        const result = await api<{ data: QualityRow[]; meta: { total: number } }>(`/catalog/completeness?${params}`);
        setQuality(result.data); setTotal(result.meta.total);
      } else {
        setExportCount(null);
        const result = await api<{ data: { count: number } }>(`/catalog/export/count?${exportParams()}`);
        setExportCount(result.data.count);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load catalog data'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [screen.id, range.from, range.to, calendarStatus, publisherId, categoryId, entityType, historyAction, historyFrom, historyTo, historyReference, query, page, exportType, exportQuery, exportStatus, exportFormat, exportFrom, exportTo]);
  useEffect(() => { if (isCalendar) void Promise.all([api<{ data: { role: string; permissions: string[] } }>('/auth/me'), api<{ data: Choice[] }>('/publishers'), api<{ data: Choice[] }>('/categories')]).then(([me, publisherResult, categoryResult]) => { setRole(me.data.role); setPermissions(me.data.permissions); setPublishers(publisherResult.data); setCategories(categoryResult.data); }).catch(() => {}); }, [isCalendar]);
  async function reschedule() {
    if (!selectedRelease) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/catalog/calendar/${selectedRelease.edition_id}`, { method: 'PATCH', body: JSON.stringify({ publicationDate: newReleaseDate, reason: scheduleReason.trim(), version: selectedRelease.version_no }) });
      setSelectedRelease(null); setScheduleReason(''); setNotice('Draft release date updated.'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not reschedule release'); }
    finally { setBusy(false); }
  }
  async function download() {
    setBusy(true); setError(''); setNotice('');
    try {
      const blob = await apiFile(`/catalog/export.csv?${exportParams()}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `catalog-${exportType}.csv`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`Downloaded ${exportType} export from the server.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed'); }
    finally { setBusy(false); }
  }
  async function viewChange(id: string) {
    setHistoryDetailLoading(true); setError('');
    try {
      const result = await api<{ data: HistoryDetail }>(`/catalog/change-history/${id}`);
      setHistoryDetail(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load change details'); }
    finally { setHistoryDetailLoading(false); }
  }
  const pagination = <div className="catalog-pagination"><span>{total} records · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}</span><div className="button-row"><button className="btn" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><button className="btn" disabled={(page + 1) * 25 >= total} onClick={() => setPage(value => value + 1)}>Next</button></div></div>;
  return <>
    <div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{isCalendar ? 'Edition release dates from the catalog.' : isHistory ? 'Recorded changes to catalog entities.' : isQuality ? 'Advisory completeness based on saved catalog data.' : 'Download authorized catalog records.'}</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    {isCalendar ? <>
      <div className="panel catalog-form-grid catalog-filter-grid"><label className="field">From date<input className="input" type="date" value={range.from} onChange={event => setRange(current => ({ ...current, from: event.target.value }))} /></label><label className="field">To date<input className="input" type="date" value={range.to} onChange={event => setRange(current => ({ ...current, to: event.target.value }))} /></label><label className="field">Edition status<select className="input" value={calendarStatus} onChange={event => setCalendarStatus(event.target.value)}><option value="">All</option><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label><label className="field">Publisher<select className="input" value={publisherId} onChange={event => setPublisherId(event.target.value)}><option value="">All publishers</option>{publishers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Category<select className="input" value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name_en}</option>)}</select></label></div>
      {loading ? <div className="panel empty">Loading releases…</div> : <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Release date</th><th>Book</th><th>Edition / Format</th><th>Publisher</th><th>Status</th><th>Actions</th></tr></thead><tbody>{calendar.length ? calendar.map(item => <tr key={item.edition_id}><td>{day(item.publication_date)}</td><td>{item.title}</td><td>{item.edition_number} · {item.format}</td><td>{item.publisher_name || '—'}</td><td>{item.edition_status}</td><td><div className="button-row"><Link className="btn" href={`/publishing-catalog/book-detail-and-timeline?book=${item.book_id}`}>Book</Link><Link className="btn" href={`/publishing-catalog/edition-detail?book=${item.book_id}&edition=${item.edition_id}`}>Edition</Link>{item.edition_status === 'draft' && (role === 'Owner' || permissions.includes('workspace.update')) && <button className="btn" onClick={() => { setSelectedRelease(item); setNewReleaseDate(day(item.publication_date)); setScheduleReason(''); }}>Reschedule</button>}</div></td></tr>) : <tr><td colSpan={6} className="empty">No edition releases in this date range.</td></tr>}</tbody></table></div>}
      {selectedRelease && <section className="panel catalog-form"><h2 className="section-title">Reschedule draft edition</h2><p>{selectedRelease.title} · Edition {selectedRelease.edition_number}</p><label className="field">New release date<input className="input" type="date" value={newReleaseDate} onChange={event => setNewReleaseDate(event.target.value)} /></label><label className="field">Reason<textarea className="input" rows={3} maxLength={500} value={scheduleReason} onChange={event => setScheduleReason(event.target.value)} /></label><div className="button-row"><button className="btn btn-primary" disabled={busy || !newReleaseDate || scheduleReason.trim().length < 10} onClick={() => void reschedule()}>Save schedule</button><button className="btn" onClick={() => setSelectedRelease(null)}>Cancel</button></div></section>}
    </> : isHistory ? <>
      <div className="panel catalog-form-grid catalog-filter-grid"><label className="field">Entity type<select className="input" value={entityType} onChange={event => { setPage(0); setEntityType(event.target.value); }}><option value="">All catalog changes</option>{['book', 'edition', 'identifier', 'catalog_price', 'book_category', 'book_contributor', 'publisher', 'imprint', 'bulk_import_job', 'catalog_discontinuation', 'catalog_duplicate_decision', 'catalog_digital_asset', 'catalog_export'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label className="field">Action<select className="input" value={historyAction} onChange={event => { setPage(0); setHistoryAction(event.target.value); }}><option value="">All actions</option>{['CREATE','UPDATE','DELETE','UPLOAD','RESCHEDULE','REQUEST','APPROVE','REJECT','REACTIVATE','REVIEW','IMPORT_CREATE','EXPORT'].map(value => <option key={value}>{value}</option>)}</select></label><label className="field">From date<input className="input" type="date" value={historyFrom} onChange={event => { setPage(0); setHistoryFrom(event.target.value); }} /></label><label className="field">To date<input className="input" type="date" value={historyTo} onChange={event => { setPage(0); setHistoryTo(event.target.value); }} /></label><label className="field">Entity ID<input className="input" value={historyReferenceInput} onChange={event => setHistoryReferenceInput(event.target.value)} placeholder="Exact UUID" /></label><button className="btn" onClick={() => { setPage(0); setHistoryReference(historyReferenceInput.trim()); }}>Find reference</button></div>
      {loading ? <div className="panel empty">Loading changes…</div> : <><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Action</th><th>Entity</th><th>Reference</th><th>Actor</th><th>Details</th></tr></thead><tbody>{history.length ? history.map(item => <tr key={item.id}><td>{day(item.occurred_at)}</td><td>{item.action}</td><td>{item.entity_type}</td><td>{item.entity_id}</td><td>{item.actor_name || '—'}</td><td><button className="btn" disabled={historyDetailLoading} onClick={() => void viewChange(item.id)}>View changes</button></td></tr>) : <tr><td colSpan={6} className="empty">No matching catalog changes.</td></tr>}</tbody></table></div>{pagination}</>}
      {historyDetail && <section className="panel catalog-form" aria-label="Catalog change details"><div className="button-row"><h2 className="section-title">Change details</h2><button className="btn" onClick={() => setHistoryDetail(null)}>Close</button></div><p>{historyDetail.action} · {historyDetail.entity_type} · {historyDetail.entity_id}</p><p className="muted">{historyDetail.actor_name || 'Unknown actor'} · {new Date(historyDetail.occurred_at).toLocaleString('en-GB')}</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(historyDetail.metadata_json ?? {}, null, 2)}</pre></section>}
    </> : isQuality ? <>
      <div className="catalog-list-controls"><input className="input" aria-label="Search books" placeholder="Search title or code" value={queryInput} onChange={event => setQueryInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setPage(0); setQuery(queryInput.trim()); } }} /><button className="btn" onClick={() => { setPage(0); setQuery(queryInput.trim()); }}>Search</button></div>
      <p className="muted">Advisory score checks nine fields: title, publisher, category, synopsis, contributor, edition, edition date, active price and validated ISBN. It does not grant publication approval.</p>
      {loading ? <div className="panel empty">Calculating completeness…</div> : <><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Book</th><th>Score</th><th>Missing evidence</th><th>Action</th></tr></thead><tbody>{quality.length ? quality.map(item => <tr key={item.id}><td>{item.bookCode || '—'}</td><td>{item.title}</td><td>{item.score}%</td><td>{item.missing.join(', ') || 'None'}</td><td><Link className="btn" href={`/publishing-catalog/edit-book?book=${item.id}`}>Open book</Link></td></tr>) : <tr><td colSpan={5} className="empty">No books match this search.</td></tr>}</tbody></table></div>{pagination}</>}
    </> : <section className="panel catalog-form"><h2 className="section-title">Catalog CSV export</h2><label className="field">Export type<select className="input" value={exportType} onChange={event => { setExportType(event.target.value); setExportStatus(''); setExportFormat(''); }}><option value="books">Books</option><option value="editions">Editions</option><option value="identifiers">Identifiers</option><option value="categories">Categories</option><option value="prices">Prices</option></select></label>{(exportType === 'books' || exportType === 'editions') && <div className="catalog-form-grid"><label className="field">Search title or code<input className="input" value={exportQueryInput} onChange={event => setExportQueryInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setExportQuery(exportQueryInput.trim()); }} /></label><label className="field">Status<select className="input" value={exportStatus} onChange={event => setExportStatus(event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value={exportType === 'books' ? 'discontinued' : 'archived'}>{exportType === 'books' ? 'Discontinued' : 'Archived'}</option></select></label>{exportType === 'editions' && <label className="field">Format<select className="input" value={exportFormat} onChange={event => setExportFormat(event.target.value)}><option value="">All formats</option>{['paperback','hardcover','ebook','audiobook','other'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>}<label className="field">From publication date<input className="input" type="date" value={exportFrom} onChange={event => setExportFrom(event.target.value)} /></label><label className="field">To publication date<input className="input" type="date" value={exportTo} onChange={event => setExportTo(event.target.value)} /></label><button className="btn" onClick={() => setExportQuery(exportQueryInput.trim())}>Apply search</button></div>}<p>{loading ? 'Counting records…' : exportCount === null ? 'Could not count records' : `${exportCount} authorized records match`}</p><p className="muted">Exports are generated on the server and limited to 5,000 rows. Formula-like spreadsheet values are escaped.</p><button className="btn btn-primary" disabled={busy || loading || exportCount === null || exportCount > 5000} onClick={() => void download()}>{busy ? 'Preparing…' : 'Download CSV'}</button></section>}
  </>;
}
