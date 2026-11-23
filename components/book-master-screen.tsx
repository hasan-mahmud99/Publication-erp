"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Book = {
  id: string; book_code: string | null; title: string; subtitle: string | null;
  short_description: string | null; synopsis: string | null; language_code: string;
  book_type: string; target_audience: string | null; planned_publication_date: string | null;
  notes: string | null; category_id: string | null; publisher_id: string | null;
  imprint_id: string | null; publication_status: string; version_no: number;
  publisher_name?: string; imprint_name?: string; category_name?: string;
  primary_author?: string; edition_count?: number; latest_publication_date?: string | null;
  linked_manuscript_id?: string | null; linked_manuscript_code?: string | null;
  linked_manuscript_title?: string | null; linked_manuscript_status?: string | null;
  created_at: string; updated_at: string;
};
type Choice = { id: string; name: string };
type Category = { id: string; name_en: string; status: string };
type Edition = { id: string; edition_number: string; format: string; publication_date: string | null; status: string };
type Contributor = { author_id: string; name: string; contributor_role: string; display_order: number };
type Event = { id: string; action: string; entity_type: string; occurred_at: string; metadata_json: string | object | null };
type ApprovedManuscript = {
  id: string;
  reference_code: string;
  title: string;
  submitter_name: string;
  author_id?: string | null;
  author_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  publisher_id?: string | null;
  publisher_name?: string | null;
  language_code?: string;
  synopsis?: string | null;
  approved_version_no?: number | null;
  proof_approved_at?: string | null;
  target_publication_date?: string | null;
  linked_edition_id?: string | null;
};
type Form = { bookCode: string; title: string; subtitle: string; shortDescription: string; synopsis: string; languageCode: string; bookType: string; targetAudience: string; plannedPublicationDate: string; notes: string; categoryId: string; publisherId: string; imprintId: string; primaryAuthorId: string; status: string };
const emptyForm: Form = { bookCode: '', title: '', subtitle: '', shortDescription: '', synopsis: '', languageCode: 'en', bookType: 'general', targetAudience: '', plannedPublicationDate: '', notes: '', categoryId: '', publisherId: '', imprintId: '', primaryAuthorId: '', status: 'draft' };
const day = (value: string | null | undefined) => value ? String(value).slice(0, 10) : '—';
const fromBook = (book: Book): Form => ({ bookCode: book.book_code || '', title: book.title, subtitle: book.subtitle || '', shortDescription: book.short_description || '', synopsis: book.synopsis || '', languageCode: book.language_code || 'en', bookType: book.book_type || 'general', targetAudience: book.target_audience || '', plannedPublicationDate: book.planned_publication_date ? day(book.planned_publication_date) : '', notes: book.notes || '', categoryId: book.category_id || '', publisherId: book.publisher_id || '', imprintId: book.imprint_id || '', primaryAuthorId: '', status: book.publication_status });
const detailPath = (id: string) => `/publishing-catalog/book-detail-and-timeline?book=${id}`;
const editPath = (id: string) => `/publishing-catalog/edit-book?book=${id}`;

export function BookMasterScreen({ screen }: { screen: Screen }) {
  const router = useRouter();
  const isList = screen.title === 'Book Catalog List';
  const isCreate = screen.title === 'Create Book' || screen.title === 'Book Master / Create Book';
  const isEdit = screen.title === 'Edit Book';
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('');
  const [sortBy, setSortBy] = useState('created');
  const [sortDir, setSortDir] = useState('desc');
  const [bookId, setBookId] = useState('');
  const [book, setBook] = useState<Book | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [loadedForm, setLoadedForm] = useState<Form>(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [publishers, setPublishers] = useState<Choice[]>([]);
  const [imprints, setImprints] = useState<Choice[]>([]);
  const [authors, setAuthors] = useState<Choice[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [timeline, setTimeline] = useState<Event[]>([]);
  const [duplicates, setDuplicates] = useState<Book[]>([]);
  const [approvedManuscripts, setApprovedManuscripts] = useState<ApprovedManuscript[]>([]);
  const [selectedManuscriptId, setSelectedManuscriptId] = useState('');
  const [createInitialEdition, setCreateInitialEdition] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Quick Add Entity modal state ('publisher' | 'imprint' | 'category' | 'author' | null)
  const [quickAddType, setQuickAddType] = useState<'publisher' | 'imprint' | 'category' | 'author' | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddCode, setQuickAddCode] = useState('');
  const [quickAddEmail, setQuickAddEmail] = useState('');
  const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');
  const dirty = (isCreate || isEdit) && JSON.stringify(form) !== JSON.stringify(loadedForm);

  async function handleQuickAddSave() {
    if (!quickAddName.trim()) {
      setQuickAddError('Name is required');
      return;
    }
    setIsSavingQuickAdd(true);
    setQuickAddError('');
    try {
      if (quickAddType === 'publisher') {
        const res = await api<{ data: { id: string; name: string } }>('/publishers', {
          method: 'POST',
          body: JSON.stringify({ name: quickAddName.trim(), code: quickAddCode.trim() || undefined, status: 'active' }),
        });
        const pubRes = await api<{ data: Choice[] }>('/publishers');
        setPublishers(pubRes.data);
        setForm(cur => ({ ...cur, publisherId: res.data.id, imprintId: '' }));
        setNotice(`Publisher "${quickAddName.trim()}" created and selected.`);
      } else if (quickAddType === 'imprint') {
        if (!form.publisherId) throw new Error('Please select a publisher first');
        const res = await api<{ data: { id: string; name: string } }>(`/publishers/${form.publisherId}/imprints`, {
          method: 'POST',
          body: JSON.stringify({ name: quickAddName.trim(), code: quickAddCode.trim() || undefined, status: 'active' }),
        });
        const impRes = await api<{ data: Choice[] }>(`/publishers/${form.publisherId}/imprints`);
        setImprints(impRes.data);
        setForm(cur => ({ ...cur, imprintId: res.data.id }));
        setNotice(`Imprint "${quickAddName.trim()}" created and selected.`);
      } else if (quickAddType === 'category') {
        const res = await api<{ data: { id: string; name_en: string } }>('/categories', {
          method: 'POST',
          body: JSON.stringify({ name: quickAddName.trim(), code: quickAddCode.trim() || quickAddName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 30), status: 'active' }),
        });
        const catRes = await api<{ data: Category[] }>('/categories');
        setCategories(catRes.data);
        setForm(cur => ({ ...cur, categoryId: res.data.id }));
        setNotice(`Category "${quickAddName.trim()}" created and selected.`);
      } else if (quickAddType === 'author') {
        const res = await api<{ data: { id: string; name: string } }>('/authors', {
          method: 'POST',
          body: JSON.stringify({ name: quickAddName.trim(), email: quickAddEmail.trim() || undefined }),
        });
        const authRes = await api<{ data: Choice[] }>('/authors');
        setAuthors(authRes.data);
        setForm(cur => ({ ...cur, primaryAuthorId: res.data.id }));
        setNotice(`Author "${quickAddName.trim()}" created and selected.`);
      }
      setQuickAddType(null);
      setQuickAddName('');
      setQuickAddCode('');
      setQuickAddEmail('');
    } catch (err: any) {
      setQuickAddError(err?.message || 'Failed to create record');
    } finally {
      setIsSavingQuickAdd(false);
    }
  }

  function change<K extends keyof Form>(key: K, value: Form[K]) { setForm(current => ({ ...current, [key]: value })); }

  function applyManuscript(ms: ApprovedManuscript, authorList = authors, pubList = publishers, catList = categories) {
    setSelectedManuscriptId(ms.id);
    let matchedAuthorId = '';
    if (ms.author_id && authorList.some(a => a.id === ms.author_id)) {
      matchedAuthorId = ms.author_id;
    } else if (ms.author_name) {
      const found = authorList.find(a => a.name.toLowerCase() === ms.author_name!.toLowerCase());
      if (found) matchedAuthorId = found.id;
    }

    let matchedPublisherId = '';
    if (ms.publisher_id && pubList.some(p => p.id === ms.publisher_id)) {
      matchedPublisherId = ms.publisher_id;
    }

    let matchedCategoryId = '';
    if (ms.category_id && catList.some(c => c.id === ms.category_id)) {
      matchedCategoryId = ms.category_id;
    }

    setForm(current => ({
      ...current,
      title: ms.title || current.title,
      synopsis: ms.synopsis || current.synopsis,
      shortDescription: ms.synopsis ? ms.synopsis.slice(0, 300) : current.shortDescription,
      languageCode: ms.language_code || current.languageCode,
      primaryAuthorId: matchedAuthorId || current.primaryAuthorId,
      publisherId: matchedPublisherId || current.publisherId,
      categoryId: matchedCategoryId || current.categoryId,
      plannedPublicationDate: ms.target_publication_date ? day(ms.target_publication_date) : current.plannedPublicationDate,
    }));
  }

  function handleSelectManuscript(id: string) {
    if (!id) {
      setSelectedManuscriptId('');
      setForm(current => ({
        ...current,
        title: '',
        subtitle: '',
        synopsis: '',
        shortDescription: '',
        languageCode: 'en',
        primaryAuthorId: '',
        publisherId: '',
        imprintId: '',
        categoryId: '',
        plannedPublicationDate: '',
      }));
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (url.searchParams.has('manuscriptId')) {
          url.searchParams.delete('manuscriptId');
          window.history.replaceState(window.history.state, '', url.pathname + (url.search ? url.search : ''));
        }
      }
      return;
    }
    const list = Array.isArray(approvedManuscripts) ? approvedManuscripts : [];
    const ms = list.find(m => m.id === id);
    if (ms) applyManuscript(ms);
  }

  async function loadList() {
    const params = new URLSearchParams({ limit: '10', offset: String(page * 10), sortBy, sortDir });
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    if (categoryFilter) params.set('categoryId', categoryFilter);
    if (publisherFilter) params.set('publisherId', publisherFilter);
    const result = await api<{ data: Book[]; meta: { total: number } }>(`/books?${params}`);
    setBooks(result.data); setTotal(result.meta.total);
  }
  async function loadBook(id: string) {
    const result = await api<{ data: Book }>(`/books/${id}`);
    setBook(result.data); setBookId(id);
    const initial = fromBook(result.data); setForm(initial); setLoadedForm(initial);
    if (!isEdit) {
      const [editionResult, contributorResult, timelineResult] = await Promise.all([
        api<{ data: Edition[] }>(`/books/${id}/editions`),
        api<{ data: Contributor[] }>(`/books/${id}/contributors`),
        api<{ data: Event[] }>(`/books/${id}/timeline`),
      ]);
      setEditions(editionResult.data); setContributors(contributorResult.data); setTimeline(timelineResult.data);
    }
  }
  useEffect(() => {
    let active = true;
    const urlParams = new URLSearchParams(window.location.search);
    const wanted = urlParams.get('book');
    const wantedManuscriptId = urlParams.get('manuscriptId');

    void Promise.all([
      api<{ data: Category[] }>('/categories'),
      api<{ data: Choice[] }>('/publishers'),
      api<{ data: Choice[] }>('/authors'),
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      api<{ data: ApprovedManuscript[] }>('/manuscripts?status=approved&limit=100').catch(() => ({ data: [] })),
    ]).then(async ([categoryResult, publisherResult, authorResult, me, msResult]) => {
      if (!active) return;
      setCategories(categoryResult.data); setPublishers(publisherResult.data); setAuthors(authorResult.data);
      setRole(me.data.role); setPermissions(me.data.permissions);
      const rawList = (msResult as any)?.data;
      const msList: ApprovedManuscript[] = Array.isArray(rawList)
        ? rawList
        : Array.isArray(rawList?.data)
        ? rawList.data
        : Array.isArray(msResult)
        ? msResult
        : [];
      setApprovedManuscripts(msList);

      if (wantedManuscriptId && isCreate) {
        let targetMs = msList.find(m => m.id === wantedManuscriptId);
        if (!targetMs) {
          try {
            const single = await api<{ data: any }>('/manuscripts/' + wantedManuscriptId);
            if (single?.data) targetMs = single.data;
          } catch {}
        }
        if (targetMs) {
          applyManuscript(targetMs, authorResult.data, publisherResult.data, categoryResult.data);
        }
      }

      if (wanted && !isCreate && !isList) await loadBook(wanted);
      else if (!isCreate && !isList) {
        const result = await api<{ data: Book[] }>('/books?limit=1');
        if (result.data[0]) await loadBook(result.data[0].id);
      }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load catalog'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [screen.id]);
  useEffect(() => { if (isList) void loadList().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load books')); }, [isList, page, search, status, categoryFilter, publisherFilter, sortBy, sortDir]);
  useEffect(() => {
    if (!form.publisherId) { setImprints([]); return; }
    void api<{ data: Choice[] }>(`/publishers/${form.publisherId}/imprints`).then(result => setImprints(result.data)).catch(() => setError('Could not load imprints'));
  }, [form.publisherId]);
  useEffect(() => {
    if ((!isCreate && !isEdit) || form.title.trim().length < 2) { setDuplicates([]); return; }
    const timer = setTimeout(() => { void api<{ data: Book[] }>(`/books/duplicate-candidates?title=${encodeURIComponent(form.title.trim())}`).then(result => setDuplicates(result.data.filter(item => item.id !== bookId))).catch(() => setDuplicates([])); }, 350);
    return () => clearTimeout(timer);
  }, [form.title, bookId, isCreate, isEdit]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  async function save(openDetail: boolean) {
    setBusy(true); setError(''); setNotice('');
    try {
      const body = {
        ...form,
        bookCode: form.bookCode.trim() || undefined,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        shortDescription: form.shortDescription.trim() || null,
        synopsis: form.synopsis.trim() || null,
        targetAudience: form.targetAudience.trim() || null,
        plannedPublicationDate: form.plannedPublicationDate || null,
        notes: form.notes.trim() || null,
        categoryId: form.categoryId || null,
        publisherId: form.publisherId || null,
        imprintId: form.imprintId || null,
        manuscriptId: selectedManuscriptId || undefined,
        createInitialEdition: selectedManuscriptId ? createInitialEdition : false,
      };
      if (isCreate) {
        const result = await api<{ data: { id: string; createdEditionId?: string } }>('/books', { method: 'POST', body: JSON.stringify(body) });
        setLoadedForm(form);
        const msText = selectedManuscriptId ? ` with linked approved manuscript${createInitialEdition ? ' & Edition 1 provisioned' : ''}` : '';
        setNotice(`Book "${body.title}" successfully created${msText}.`);
        if (openDetail) router.push(detailPath(result.data.id));
        else router.push(editPath(result.data.id));
      } else if (book) {
        await api(`/books/${book.id}`, { method: 'PATCH', body: JSON.stringify({ ...body, primaryAuthorId: undefined, version: book.version_no }) });
        await loadBook(book.id); setNotice('Book changes saved.');
        if (openDetail) router.push(detailPath(book.id));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save book'); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setError('');
    try { if (isList) await loadList(); else if (bookId && !isCreate) await loadBook(bookId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Refresh failed'); }
  }
  const field = (label: string, key: keyof Form, maxLength = 500, required = false) => (
    <label className="field" key={key}>
      <span>{label}{required && <span className="required-star" style={{ color: '#dc2626', marginLeft: '3px', fontWeight: 'bold' }}>*</span>}</span>
      <input className="input" value={form[key]} maxLength={maxLength} onChange={event => change(key, event.target.value)} />
    </label>
  );

  const manuscriptList = Array.isArray(approvedManuscripts) ? approvedManuscripts : [];
  const selectedManuscript = manuscriptList.find(m => m.id === selectedManuscriptId);

  return <>
    <div className="page-heading">
      <div>
        <h1 className="page-title">{screen.title}</h1>
        <p className="muted">Book Master &amp; Commercial Catalog Management with Editorial Handoff.</p>
      </div>
      <button className="btn" onClick={() => void refresh()}>Refresh</button>
    </div>

    {/* Navigation Tabs for seamless switching between List and Create/Book Master */}
    <div className="tab-nav" style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
      <Link className={`btn ${isList ? 'btn-primary' : ''}`} href="/publishing-catalog/book-catalog-list">
        📚 Book Catalog List ({total > 0 ? total : books.length})
      </Link>
      <Link className={`btn ${isCreate ? 'btn-primary' : ''}`} href="/publishing-catalog/create-book">
        ✨ Create Book (Book Master) {manuscriptList.length > 0 && <span style={{ background: '#16a34a', color: '#fff', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', marginLeft: '6px' }}>{manuscriptList.length} Approved</span>}
      </Link>
      {isEdit && book && (
        <span className="btn btn-primary" style={{ cursor: 'default' }}>
          ✏️ Edit Book: {book.title}
        </span>
      )}
      {!isList && !isCreate && !isEdit && book && (
        <span className="btn btn-primary" style={{ cursor: 'default' }}>
          📖 Book Detail: {book.title}
        </span>
      )}
    </div>

    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    {loading ? <div className="panel empty">Loading catalog…</div> : isList ? <>
      <div className="catalog-list-controls"><input className="input" aria-label="Search books" placeholder="Title, code, author or ISBN" value={searchInput} onChange={event => setSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setPage(0); setSearch(searchInput.trim()); } }} /><button className="btn" onClick={() => { setPage(0); setSearch(searchInput.trim()); }}>Search</button>{canCreate && <Link className="btn btn-primary" href="/publishing-catalog/create-book">Create book</Link>}</div>
      <div className="panel catalog-form-grid catalog-filter-grid"><label className="field">Status<select className="input" value={status} onChange={event => { setPage(0); setStatus(event.target.value); }}><option value="">All statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value="discontinued">Discontinued</option></select></label><label className="field">Category<select className="input" value={categoryFilter} onChange={event => { setPage(0); setCategoryFilter(event.target.value); }}><option value="">All categories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name_en}</option>)}</select></label><label className="field">Publisher<select className="input" value={publisherFilter} onChange={event => { setPage(0); setPublisherFilter(event.target.value); }}><option value="">All publishers</option>{publishers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Sort<select className="input" value={`${sortBy}:${sortDir}`} onChange={event => { const [column, direction] = event.target.value.split(':'); setSortBy(column); setSortDir(direction); }}><option value="created:desc">Newest</option><option value="created:asc">Oldest</option><option value="name:asc">Title A–Z</option><option value="name:desc">Title Z–A</option><option value="publicationDate:asc">Planned date</option><option value="status:asc">Status</option></select></label></div>
      <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Title</th><th>Author</th><th>Publisher / Category</th><th>Editions</th><th>Latest release</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{books.length ? books.map(item => <tr key={item.id}><td>{item.book_code || '—'}</td><td>{item.title}</td><td>{item.primary_author || '—'}</td><td>{item.publisher_name || '—'}<br />{item.category_name || '—'}</td><td>{item.edition_count ?? 0}</td><td>{day(item.latest_publication_date)}</td><td>{item.publication_status}</td><td>{day(item.updated_at)}</td><td><div className="button-row"><Link className="btn" href={detailPath(item.id)}>View</Link>{canUpdate && <Link className="btn" href={editPath(item.id)}>Edit</Link>}</div></td></tr>) : <tr><td colSpan={9} className="empty">No books match these filters.</td></tr>}</tbody></table></div>
      <div className="catalog-pagination"><span>{total} books · Page {page + 1} of {Math.max(1, Math.ceil(total / 10))}</span><div className="button-row"><button className="btn" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><button className="btn" disabled={(page + 1) * 10 >= total} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    </> : (isCreate || isEdit) ? <section className="panel catalog-form">
      {isEdit && <label className="field">Book<select className="input" value={bookId} onChange={event => { if (dirty && !window.confirm('Discard unsaved changes?')) return; void loadBook(event.target.value).catch(reason => setError(reason.message)); }}><option value="">Select a book</option>{book && <option value={book.id}>{book.title}</option>}</select></label>}

      {/* Prominent Editorial Handoff Banner in Create Book */}
      {isCreate && (
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', border: '1px solid #86efac', borderRadius: '10px', padding: '16px', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>📖</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#166534' }}>
                  Editorial Handoff: Import from Approved Manuscript
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#15803d' }}>
                  Pre-fill title, author, category, publisher, and synopsis directly from an approved proof submission.
                </p>
              </div>
            </div>
            <span className="badge badge-green" style={{ fontSize: '12px', padding: '4px 10px' }}>
              {manuscriptList.length} Approved Manuscripts
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'flex-end' }}>
            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontWeight: 700, color: '#166534' }}>Choose an Approved Manuscript:</span>
              <select
                className="input"
                value={selectedManuscriptId}
                onChange={e => handleSelectManuscript(e.target.value)}
                style={{ borderColor: '#86efac', background: '#ffffff', fontWeight: 500 }}
              >
                <option value="">-- Select an approved manuscript to pre-fill --</option>
                {manuscriptList.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.reference_code} · {m.title} (by {m.author_name || m.submitter_name || 'Author'}) · Approved v{m.approved_version_no || 1}
                  </option>
                ))}
              </select>
            </label>
            {selectedManuscriptId && (
              <button
                className="btn"
                type="button"
                style={{ height: '38px', whiteSpace: 'nowrap' }}
                onClick={() => handleSelectManuscript('')}
                title="Clear selected manuscript and reset imported form fields"
              >
                ✕ Clear Selection
              </button>
            )}
          </div>

          {selectedManuscript && (
            <div style={{ marginTop: '14px', padding: '12px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '13px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '10px' }}>
                <span>Reference: <strong>{selectedManuscript.reference_code}</strong></span>
                <span>Author: <strong>{selectedManuscript.author_name || 'Not set'}</strong></span>
                <span>Category: <strong>{selectedManuscript.category_name || 'Not set'}</strong></span>
                <span>Publisher: <strong>{selectedManuscript.publisher_name || 'Not set'}</strong></span>
                <span>Approved Proof: <strong>v{selectedManuscript.approved_version_no || 1}</strong></span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, color: '#14532d', paddingTop: '4px', borderTop: '1px dashed #bbf7d0' }}>
                <input
                  type="checkbox"
                  checked={createInitialEdition}
                  onChange={e => setCreateInitialEdition(e.target.checked)}
                />
                <span>Automatically create initial Edition (Edition 1 · Paperback) and link this approved manuscript seamlessly</span>
              </label>
            </div>
          )}
        </div>
      )}

      <h2 className="section-title">Identity</h2>
      <div className="catalog-form-grid">
        {field('Book code (leave blank to generate)', 'bookCode', 80)}
        {field('Title', 'title', 500, true)}
        {field('Subtitle', 'subtitle')}
        {field('Language code', 'languageCode', 12)}
        <label className="field">
          <span>Book type <span className="required-star" style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span></span>
          <select className="input" value={form.bookType} onChange={event => change('bookType', event.target.value)}>
            {['general', 'education', 'academic', 'religious', 'children', 'reference', 'other'].map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        {field('Target audience', 'targetAudience', 120)}
      </div>
      {duplicates.length > 0 && <p className="alert-error" role="status">Similar title found: {duplicates.map(item => item.book_code || item.title).join(', ')}. Review the records; separate books may share a title.</p>}

      <h2 className="section-title">Publishing &amp; Contributors</h2>
      <div className="catalog-form-grid">
        <label className="field">
          <span style={{ fontWeight: 600 }}>Publisher</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select className="input" value={form.publisherId} onChange={event => setForm(current => ({ ...current, publisherId: event.target.value, imprintId: '' }))} style={{ flex: 1 }}>
              <option value="">No publisher</option>
              {publishers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => { setQuickAddType('publisher'); setQuickAddName(''); setQuickAddCode(''); setQuickAddError(''); }}
              title="Add new publisher"
              style={{ whiteSpace: 'nowrap', padding: '6px 10px', fontWeight: 700 }}
            >
              ➕
            </button>
          </div>
        </label>
        <label className="field">
          <span style={{ fontWeight: 600 }}>Imprint</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select className="input" value={form.imprintId} disabled={!form.publisherId} onChange={event => change('imprintId', event.target.value)} style={{ flex: 1 }}>
              <option value="">No imprint</option>
              {imprints.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {form.publisherId && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => { setQuickAddType('imprint'); setQuickAddName(''); setQuickAddCode(''); setQuickAddError(''); }}
                title="Add new imprint for this publisher"
                style={{ whiteSpace: 'nowrap', padding: '6px 10px', fontWeight: 700 }}
              >
                ➕
              </button>
            )}
          </div>
        </label>
        <label className="field">
          <span style={{ fontWeight: 600 }}>Category</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select className="input" value={form.categoryId} onChange={event => change('categoryId', event.target.value)} style={{ flex: 1 }}>
              <option value="">No category</option>
              {categories.filter(item => item.status === 'active' || item.id === form.categoryId).map(item => <option key={item.id} value={item.id}>{item.name_en}</option>)}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => { setQuickAddType('category'); setQuickAddName(''); setQuickAddCode(''); setQuickAddError(''); }}
              title="Add new category"
              style={{ whiteSpace: 'nowrap', padding: '6px 10px', fontWeight: 700 }}
            >
              ➕
            </button>
          </div>
        </label>
        {isCreate && (
          <label className="field">
            <span style={{ fontWeight: 600 }}>Primary author</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select className="input" value={form.primaryAuthorId} onChange={event => change('primaryAuthorId', event.target.value)} style={{ flex: 1 }}>
                <option value="">Assign later</option>
                {authors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => { setQuickAddType('author'); setQuickAddName(''); setQuickAddEmail(''); setQuickAddError(''); }}
                title="Add new author"
                style={{ whiteSpace: 'nowrap', padding: '6px 10px', fontWeight: 700 }}
              >
                ➕
              </button>
            </div>
          </label>
        )}
        <label className="field">
          <span>Planned publication date</span>
          <input className="input" type="date" value={form.plannedPublicationDate} onChange={event => change('plannedPublicationDate', event.target.value)} />
        </label>
        <label className="field">
          <span>Status <span className="required-star" style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span></span>
          <select className="input" value={form.status} onChange={event => change('status', event.target.value)}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            {!isCreate && book?.publication_status === 'discontinued' && <option value="discontinued">Discontinued</option>}
          </select>
        </label>
      </div>

      {isEdit && <p className="muted">Discontinuation and reactivation require the <Link href="/publishing-catalog/discontinued-titles">Discontinued Titles approval workflow</Link>.</p>}
      <h2 className="section-title">Description</h2>
      <label className="field">
        <span>Short description</span>
        <textarea className="input" maxLength={1000} value={form.shortDescription} onChange={event => change('shortDescription', event.target.value)} />
      </label>
      <label className="field">
        <span>Synopsis</span>
        <textarea className="input" rows={5} maxLength={20000} value={form.synopsis} onChange={event => change('synopsis', event.target.value)} />
      </label>
      <label className="field">
        <span>Internal notes</span>
        <textarea className="input" maxLength={5000} value={form.notes} onChange={event => change('notes', event.target.value)} />
      </label>

      <div className="button-row">
        {(isCreate ? canCreate : canUpdate) && <>
          <button className="btn btn-primary" disabled={busy || !form.title.trim() || (isEdit && !book)} onClick={() => void save(false)}>
            {busy ? 'Saving…' : isCreate ? 'Save book' : 'Save changes'}
          </button>
          <button className="btn" disabled={busy || !form.title.trim() || (isEdit && !book)} onClick={() => void save(true)}>
            Save and view
          </button>
        </>}
        {isEdit && <button className="btn" disabled={!dirty} onClick={() => setForm(loadedForm)}>Reset changes</button>}
        <Link className="btn" href="/publishing-catalog/book-catalog-list" onClick={event => { if (dirty && !window.confirm('Discard unsaved changes?')) event.preventDefault(); }}>
          Cancel
        </Link>
      </div>
    </section> : book ? <>
      <section className="panel catalog-form">
        <h2 className="section-title">{book.title}</h2>
        <p>{book.book_code || 'No code'} · {book.publication_status} · {book.book_type} · {book.language_code}</p>
        {book.subtitle && <p>{book.subtitle}</p>}
        <p>{book.short_description || 'No short description recorded.'}</p>
        <p>{book.synopsis && <p>{book.synopsis}</p>}</p>

        {/* Linked Editorial Manuscript Callout */}
        {book.linked_manuscript_id && (
          <div style={{ margin: '14px 0', padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <strong style={{ color: '#166534' }}>🔗 Originated from Editorial Manuscript:</strong>
                <span style={{ marginLeft: '8px', color: '#15803d', fontWeight: 600 }}>
                  {book.linked_manuscript_code} · {book.linked_manuscript_title || book.title}
                </span>
                <span className="badge badge-green" style={{ marginLeft: '8px', fontSize: '11px' }}>{book.linked_manuscript_status || 'approved'}</span>
              </div>
              <Link className="btn btn-sm" href={`/manuscript-editorial/manuscript-detail?manuscript=${book.linked_manuscript_id}`}>
                View Manuscript &amp; Proofs ➔
              </Link>
            </div>
          </div>
        )}

        <div className="catalog-form-grid">
          <p>Publisher: {book.publisher_name || '—'}</p>
          <p>Imprint: {book.imprint_name || '—'}</p>
          <p>Category: {book.category_name || '—'}</p>
          <p>Planned release: {day(book.planned_publication_date)}</p>
          <p>Created: {day(book.created_at)}</p>
          <p>Updated: {day(book.updated_at)}</p>
        </div>
        <div className="button-row">
          {canUpdate && <Link className="btn" href={editPath(book.id)}>Edit book</Link>}
          {canCreate && <Link className="btn btn-primary" href={`/publishing-catalog/create-edit-edition?book=${book.id}`}>Add edition</Link>}
          <Link className="btn" href="/publishing-catalog/publication-calendar">Publication calendar</Link>
        </div>
      </section>

      <section className="panel catalog-form">
        <h2 className="section-title">Contributors</h2>
        {contributors.length ? contributors.map(item => <p key={`${item.author_id}-${item.contributor_role}`}>{item.name} · {item.contributor_role}</p>) : <p className="muted">No contributors assigned.</p>}
        <Link className="btn" href={`/publishing-catalog/author-contributor-assignment?book=${book.id}`}>Manage contributors</Link>
      </section>

      <section className="panel catalog-form">
        <h2 className="section-title">Editions</h2>
        {editions.length ? editions.map(item => <p key={item.id}><Link href={`/publishing-catalog/edition-detail?book=${book.id}&edition=${item.id}`}>Edition {item.edition_number} · {item.format}</Link> · {day(item.publication_date)} · {item.status}</p>) : <p className="muted">No editions yet.</p>}
      </section>

      <section className="panel catalog-form">
        <h2 className="section-title">Change timeline</h2>
        {timeline.length ? timeline.map(item => <p key={item.id}>{day(item.occurred_at)} · {item.action} · {item.entity_type}</p>) : <p className="muted">No change events yet.</p>}
      </section>
    </> : <p className="panel empty">No book selected. <Link href="/publishing-catalog/book-catalog-list">Open the catalog</Link>.</p>}

    {/* Quick Add Entity Modal */}
    {quickAddType && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }}
        onClick={e => { if (e.target === e.currentTarget) setQuickAddType(null); }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              ➕ Quick Add {quickAddType.charAt(0).toUpperCase() + quickAddType.slice(1)}
            </h3>
            <button
              type="button"
              onClick={() => setQuickAddType(null)}
              style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          {quickAddError && (
            <div className="alert-error" style={{ marginBottom: '12px', fontSize: '13px' }}>
              {quickAddError}
            </div>
          )}

          <div style={{ display: 'grid', gap: '12px' }}>
            <label className="field">
              <span>{quickAddType === 'author' ? 'Author Name' : `${quickAddType.charAt(0).toUpperCase() + quickAddType.slice(1)} Name`} <span style={{ color: '#dc2626' }}>*</span></span>
              <input
                className="input"
                autoFocus
                placeholder={`Enter ${quickAddType} name`}
                value={quickAddName}
                onChange={e => setQuickAddName(e.target.value)}
              />
            </label>

            {quickAddType !== 'author' && (
              <label className="field">
                <span>Code (optional)</span>
                <input
                  className="input"
                  placeholder="e.g. CODE-01"
                  value={quickAddCode}
                  onChange={e => setQuickAddCode(e.target.value)}
                />
              </label>
            )}

            {quickAddType === 'author' && (
              <label className="field">
                <span>Email Address (optional)</span>
                <input
                  className="input"
                  type="email"
                  placeholder="author@example.com"
                  value={quickAddEmail}
                  onChange={e => setQuickAddEmail(e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="button-row" style={{ marginTop: '20px', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn" onClick={() => setQuickAddType(null)} disabled={isSavingQuickAdd}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSavingQuickAdd || !quickAddName.trim()}
              onClick={() => void handleQuickAddSave()}
            >
              {isSavingQuickAdd ? 'Saving…' : 'Save & Select'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>;
}
