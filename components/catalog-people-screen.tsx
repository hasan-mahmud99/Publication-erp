"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Book = { id: string; title: string };
type Author = { id: string; name: string };
type Contributor = { author_id: string; name: string; contributor_role: string; display_order: number };
type Publisher = { id: string; code: string | null; name: string; legal_name: string | null; contact_email: string | null; website: string | null; status: string; version_no: number; book_count: number };
type Imprint = { id: string; code: string | null; name: string; description: string | null; status: string; version_no: number };
const roles = ['author', 'editor', 'translator', 'illustrator', 'other'];

export function CatalogPeopleScreen({ screen }: { screen: Screen }) {
  const isContributor = screen.title === 'Author/Contributor Assignment';
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [authors, setAuthors] = useState<Author[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [authorId, setAuthorId] = useState('');
  const [roleValue, setRoleValue] = useState('author');
  const [order, setOrder] = useState('0');
  const [editingAssignment, setEditingAssignment] = useState<Contributor | null>(null);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [publisherId, setPublisherId] = useState('');
  const [imprints, setImprints] = useState<Imprint[]>([]);
  const [publisherForm, setPublisherForm] = useState({ code: '', name: '', legalName: '', email: '', website: '', status: 'active' });
  const [editingPublisher, setEditingPublisher] = useState(false);
  const [imprintForm, setImprintForm] = useState({ code: '', name: '', description: '', status: 'active' });
  const [editingImprint, setEditingImprint] = useState<Imprint | null>(null);
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');
  const canDelete = role === 'Owner' || permissions.includes('workspace.delete');
  const selectedPublisher = publishers.find(item => item.id === publisherId);
  async function loadBooks(q = '') {
    const result = await api<{ data: Book[] }>(`/books?limit=25${q ? `&q=${encodeURIComponent(q)}` : ''}`);
    setBooks(current => result.data.some(item => item.id === bookId) ? result.data : [...result.data, ...current.filter(item => item.id === bookId)]);
  }
  async function loadPublishers() {
    const result = await api<{ data: Publisher[] }>('/publishers'); setPublishers(result.data);
    setPublisherId(current => current || result.data[0]?.id || '');
  }
  async function loadContributors(id: string) {
    const result = await api<{ data: Contributor[] }>(`/books/${id}/contributors`); setContributors(result.data);
  }
  async function loadImprints(id: string) {
    const result = await api<{ data: Imprint[] }>(`/publishers/${id}/imprints`); setImprints(result.data);
  }
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('book') || '';
    void Promise.all([api<{ data: { role: string; permissions: string[] } }>('/auth/me'), isContributor ? api<{ data: Author[] }>('/authors') : api<{ data: Publisher[] }>('/publishers'), isContributor ? api<{ data: Book[] }>('/books?limit=25') : Promise.resolve({ data: [] as Book[] })])
      .then(async ([me, masters, bookResult]) => {
        setRole(me.data.role); setPermissions(me.data.permissions);
        if (isContributor) {
          setAuthors(masters.data as Author[]);
          const available = bookResult.data;
          if (wanted && !available.some(item => item.id === wanted)) {
            const detail = await api<{ data: Book }>(`/books/${wanted}`);
            available.push(detail.data);
          }
          setBooks(available); setBookId(wanted || available[0]?.id || '');
        } else {
          setPublishers(masters.data as Publisher[]);
          setPublisherId((masters.data as Publisher[])[0]?.id || '');
        }
      }).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load catalog people'))
      .finally(() => setLoading(false));
  }, [screen.id]);
  useEffect(() => { if (bookId && isContributor) void loadContributors(bookId).catch(reason => setError(reason.message)); }, [bookId, isContributor]);
  useEffect(() => { if (!publisherId || isContributor) { setImprints([]); return; } void loadImprints(publisherId).catch(reason => setError(reason.message)); }, [publisherId, isContributor]);
  async function run(task: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function assign() {
    if (!bookId || !authorId) return;
    await run(async () => {
      await api(`/books/${bookId}/contributors`, { method: 'POST', body: JSON.stringify({ authorId, role: roleValue, displayOrder: Number(order) }) });
      await loadContributors(bookId); setAuthorId(''); setOrder('0');
    }, 'Contributor assigned to this book.');
  }
  async function updateAssignment() {
    if (!editingAssignment) return;
    await run(async () => {
      await api(`/books/${bookId}/contributors/${editingAssignment.author_id}/${editingAssignment.contributor_role}`, { method: 'PATCH', body: JSON.stringify({ role: roleValue, displayOrder: Number(order) }) });
      await loadContributors(bookId); setEditingAssignment(null);
    }, 'Contributor assignment updated.');
  }
  async function remove(item: Contributor) {
    if (!window.confirm(`Remove ${item.name} from this book? The author record will remain.`)) return;
    await run(async () => { await api(`/books/${bookId}/contributors/${item.author_id}/${item.contributor_role}`, { method: 'DELETE' }); await loadContributors(bookId); }, 'Contributor assignment removed.');
  }
  async function savePublisher() {
    await run(async () => {
      const body = { name: publisherForm.name.trim(), code: publisherForm.code.trim() || (editingPublisher ? null : undefined), legalName: publisherForm.legalName.trim() || (editingPublisher ? null : undefined), email: publisherForm.email.trim() || (editingPublisher ? null : undefined), website: publisherForm.website.trim() || (editingPublisher ? null : undefined), status: publisherForm.status };
      if (editingPublisher && selectedPublisher) await api(`/publishers/${selectedPublisher.id}`, { method: 'PATCH', body: JSON.stringify({ ...body, version: selectedPublisher.version_no }) });
      else { const result = await api<{ data: { id: string } }>('/publishers', { method: 'POST', body: JSON.stringify(body) }); setPublisherId(result.data.id); }
      setEditingPublisher(false); setPublisherForm({ code: '', name: '', legalName: '', email: '', website: '', status: 'active' }); await loadPublishers();
    }, 'Publisher saved.');
  }
  async function saveImprint() {
    if (!publisherId) return;
    await run(async () => {
      const body = { name: imprintForm.name.trim(), code: imprintForm.code.trim() || (editingImprint ? null : undefined), description: imprintForm.description.trim() || (editingImprint ? null : undefined), status: imprintForm.status };
      if (editingImprint) await api(`/publishers/${publisherId}/imprints/${editingImprint.id}`, { method: 'PATCH', body: JSON.stringify({ ...body, version: editingImprint.version_no }) });
      else await api(`/publishers/${publisherId}/imprints`, { method: 'POST', body: JSON.stringify(body) });
      await loadImprints(publisherId); setEditingImprint(null); setImprintForm({ code: '', name: '', description: '', status: 'active' });
    }, 'Imprint saved.');
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{isContributor ? 'Credit authors and other contributors on each book.' : 'Manage publishing entities and their imprints.'}</p></div><button className="btn" onClick={() => void (isContributor ? loadContributors(bookId) : loadPublishers()).catch(reason => setError(reason.message))}>Refresh</button></div>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    {loading ? <div className="panel empty">Loading…</div> : isContributor ? <>
      <div className="panel catalog-form"><div className="catalog-form-grid"><label className="field">Find book<input className="input" value={bookSearch} onChange={event => setBookSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void loadBooks(bookSearch).catch(reason => setError(reason.message)); }} /></label><button className="btn" onClick={() => void loadBooks(bookSearch).catch(reason => setError(reason.message))}>Search books</button><label className="field">Book<select className="input" value={bookId} onChange={event => setBookId(event.target.value)}><option value="">Select a book</option>{books.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div></div>
      {bookId && <section className="panel catalog-form"><h2 className="section-title">Assigned contributors</h2>{contributors.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Contributor</th><th>Role</th><th>Order</th><th>Actions</th></tr></thead><tbody>{contributors.map(item => <tr key={`${item.author_id}-${item.contributor_role}`}><td>{item.name}</td><td>{item.contributor_role}</td><td>{item.display_order}</td><td><div className="button-row">{canUpdate && <button className="btn" onClick={() => { setEditingAssignment(item); setAuthorId(item.author_id); setRoleValue(item.contributor_role); setOrder(String(item.display_order)); }}>Edit</button>}{canDelete && <button className="btn" onClick={() => void remove(item)}>Remove</button>}</div></td></tr>)}</tbody></table></div> : <p className="muted">No contributors assigned to this book.</p>}{(canCreate || (editingAssignment && canUpdate)) && <div className="catalog-form-grid"><label className="field">Contributor<select className="input" disabled={Boolean(editingAssignment)} value={authorId} onChange={event => setAuthorId(event.target.value)}><option value="">Select contributor</option>{authors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Role<select className="input" value={roleValue} onChange={event => setRoleValue(event.target.value)}>{roles.map(item => <option key={item}>{item}</option>)}</select></label><label className="field">Display order<input className="input" type="number" min="0" max="9999" value={order} onChange={event => setOrder(event.target.value)} /></label><div className="button-row"><button className="btn btn-primary" disabled={busy || !authorId} onClick={() => void (editingAssignment ? updateAssignment() : assign())}>{editingAssignment ? 'Save assignment' : 'Assign contributor'}</button>{editingAssignment && <button className="btn" onClick={() => { setEditingAssignment(null); setAuthorId(''); setOrder('0'); }}>Cancel edit</button>}</div></div>}</section>}
      <Link className="btn" href="/publishing-catalog/book-catalog-list">Open book catalog</Link>
    </> : <>
      <section className="panel catalog-form"><h2 className="section-title">Publishers</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Books</th><th>Status</th><th>Action</th></tr></thead><tbody>{publishers.map(item => <tr key={item.id}><td>{item.code || '—'}</td><td>{item.name}</td><td>{item.book_count}</td><td>{item.status}</td><td><button className="btn" onClick={() => { setPublisherId(item.id); setEditingPublisher(true); setPublisherForm({ code: item.code || '', name: item.name, legalName: item.legal_name || '', email: item.contact_email || '', website: item.website || '', status: item.status }); }}>Manage</button></td></tr>)}</tbody></table></div>{(canCreate || (editingPublisher && canUpdate)) && <><h3>{editingPublisher ? 'Edit publisher' : 'New publisher'}</h3><div className="catalog-form-grid"><label className="field">Code<input className="input" value={publisherForm.code} onChange={event => setPublisherForm(current => ({ ...current, code: event.target.value }))} /></label><label className="field">Name *<input className="input" value={publisherForm.name} onChange={event => setPublisherForm(current => ({ ...current, name: event.target.value }))} /></label><label className="field">Legal name<input className="input" value={publisherForm.legalName} onChange={event => setPublisherForm(current => ({ ...current, legalName: event.target.value }))} /></label><label className="field">Email<input className="input" type="email" value={publisherForm.email} onChange={event => setPublisherForm(current => ({ ...current, email: event.target.value }))} /></label><label className="field">Website<input className="input" type="url" value={publisherForm.website} onChange={event => setPublisherForm(current => ({ ...current, website: event.target.value }))} /></label><label className="field">Status<select className="input" value={publisherForm.status} onChange={event => setPublisherForm(current => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><div className="button-row"><button className="btn btn-primary" disabled={busy || !publisherForm.name.trim()} onClick={() => void savePublisher()}>Save publisher</button><button className="btn" onClick={() => { setEditingPublisher(false); setPublisherForm({ code: '', name: '', legalName: '', email: '', website: '', status: 'active' }); }}>New publisher</button></div></>}</section>
      <section className="panel catalog-form">
        <h2 className="section-title">Imprints</h2>
        <label className="field">
          <span style={{ fontWeight: 600 }}>Parent Publisher</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select className="input" value={publisherId} onChange={event => setPublisherId(event.target.value)} style={{ flex: 1 }}>
              <option value="">Select publisher</option>
              {publishers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setEditingPublisher(false);
                setPublisherForm({ code: '', name: '', legalName: '', email: '', website: '', status: 'active' });
              }}
              title="Add new publisher"
              style={{ whiteSpace: 'nowrap', padding: '6px 10px', fontWeight: 700 }}
            >
              ➕ New Publisher
            </button>
          </div>
        </label>
        {imprints.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Action</th></tr></thead><tbody>{imprints.map(item => <tr key={item.id}><td>{item.code || '—'}</td><td>{item.name}</td><td>{item.status}</td><td>{canUpdate && <button className="btn" onClick={() => { setEditingImprint(item); setImprintForm({ code: item.code || '', name: item.name, description: item.description || '', status: item.status }); }}>Edit</button>}</td></tr>)}</tbody></table></div> : <p className="muted">No imprints for this publisher.</p>}{publisherId && (canCreate || (editingImprint && canUpdate)) && <><h3>{editingImprint ? 'Edit imprint' : 'New imprint'}</h3><div className="catalog-form-grid"><label className="field">Code<input className="input" value={imprintForm.code} onChange={event => setImprintForm(current => ({ ...current, code: event.target.value }))} /></label><label className="field">Name *<input className="input" value={imprintForm.name} onChange={event => setImprintForm(current => ({ ...current, name: event.target.value }))} /></label><label className="field">Status<select className="input" value={imprintForm.status} onChange={event => setImprintForm(current => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><label className="field">Description<textarea className="input" value={imprintForm.description} onChange={event => setImprintForm(current => ({ ...current, description: event.target.value }))} /></label><div className="button-row"><button className="btn btn-primary" disabled={busy || !imprintForm.name.trim()} onClick={() => void saveImprint()}>Save imprint</button>{editingImprint && <button className="btn" onClick={() => { setEditingImprint(null); setImprintForm({ code: '', name: '', description: '', status: 'active' }); }}>Cancel edit</button>}</div></>}</section>
    </>}
  </>;
}
