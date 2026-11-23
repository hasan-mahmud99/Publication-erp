"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Book = {
  id: string;
  title: string;
  book_code?: string | null;
  publisher_id?: string | null;
  publisher_name?: string | null;
  primary_author?: string | null;
  category_name?: string | null;
  publication_status?: string | null;
  edition_count?: number;
};

type Publisher = { id: string; name: string };
type Edition = {
  id: string;
  book_id: string;
  book_title?: string;
  edition_code: string | null;
  edition_number: string;
  revision_number: string | null;
  release_version: string | null;
  edition_title: string | null;
  format: string;
  language_code: string;
  page_count: number | null;
  trim_size: string | null;
  paper_type: string | null;
  paper_gsm: number | null;
  binding_type: string | null;
  weight_grams: number | null;
  digital_mime_type: string | null;
  access_type: string | null;
  publication_date: string | null;
  status: string;
  publisher_id: string | null;
  publisher_name?: string;
  version_no: number;
  isbn?: string | null;
  cover_price?: string | null;
};

type Identifier = { id: string; identifier_type: string; identifier_value: string; status: string };
type Price = { id: string; price_type: string; currency_code: string; amount: string; effective_from: string; effective_to: string | null; status: string };
type Form = {
  editionCode: string;
  editionNumber: string;
  revisionNumber: string;
  releaseVersion: string;
  editionTitle: string;
  format: string;
  pageCount: string;
  trimSize: string;
  paperType: string;
  paperGsm: string;
  bindingType: string;
  weightGrams: string;
  digitalMimeType: string;
  accessType: string;
  publicationDate: string;
  status: string;
  publisherId: string;
};

const blank: Form = {
  editionCode: '',
  editionNumber: '1',
  revisionNumber: '',
  releaseVersion: '',
  editionTitle: '',
  format: 'paperback',
  pageCount: '',
  trimSize: '',
  paperType: '',
  paperGsm: '',
  bindingType: '',
  weightGrams: '',
  digitalMimeType: '',
  accessType: '',
  publicationDate: '',
  status: 'draft',
  publisherId: '',
};

const day = (value: string | null | undefined) => value ? String(value).slice(0, 10) : '—';
const toForm = (item: Edition): Form => ({
  editionCode: item.edition_code || '',
  editionNumber: item.edition_number,
  revisionNumber: item.revision_number || '',
  releaseVersion: item.release_version || '',
  editionTitle: item.edition_title || '',
  format: item.format,
  pageCount: item.page_count == null ? '' : String(item.page_count),
  trimSize: item.trim_size || '',
  paperType: item.paper_type || '',
  paperGsm: item.paper_gsm == null ? '' : String(item.paper_gsm),
  bindingType: item.binding_type || '',
  weightGrams: item.weight_grams == null ? '' : String(item.weight_grams),
  digitalMimeType: item.digital_mime_type || '',
  accessType: item.access_type || '',
  publicationDate: item.publication_date ? day(item.publication_date) : '',
  status: item.status,
  publisherId: item.publisher_id || '',
});

const detailPath = (item: Edition) => `/publishing-catalog/edition-detail?book=${item.book_id}&edition=${item.id}`;

const PRESETS = [
  { label: 'Standard Paperback', format: 'paperback', trimSize: '5.5" x 8.5"', paperType: '70 GSM Offset', paperGsm: '70', bindingType: 'Perfect Bound (Paperback)' },
  { label: 'Royal Hardcover', format: 'hardcover', trimSize: '6" x 9"', paperType: '80 GSM Cream Offset', paperGsm: '80', bindingType: 'Case Laminate (Hardcover)' },
  { label: 'Textbook / Large', format: 'paperback', trimSize: '7" x 10"', paperType: '75 GSM White', paperGsm: '75', bindingType: 'Section Sewn Paperback' },
  { label: 'Pocket Book', format: 'paperback', trimSize: '4.25" x 6.87"', paperType: '60 GSM Newsprint', paperGsm: '60', bindingType: 'Paperback' },
];

const DEFAULT_TRIM_SIZES = [
  '5.5" x 8.5"',
  '6" x 9"',
  '5" x 8"',
  '4.25" x 6.87"',
  '7" x 10"',
  '8.5" x 11"',
  'A5 (5.83" x 8.27")',
  'A4 (8.27" x 11.69")',
  'B5 (6.9" x 9.8")',
];

const DEFAULT_PAPER_TYPES = [
  '70 GSM White Offset',
  '80 GSM White Offset',
  '80 GSM Cream Offset / Woodfree',
  '60 GSM Newsprint / Book Paper',
  '75 GSM White Bond',
  '100 GSM Art Paper',
  '120 GSM Art Paper',
  '128 GSM Matte Coated Art',
  '150 GSM Gloss Coated',
];

const DEFAULT_BINDING_TYPES = [
  'Perfect Bound (Paperback)',
  'Case Laminate (Hardcover)',
  'Cloth Bound (Hardcover with Dust Jacket)',
  'Saddle Stitch (Stapled Booklet)',
  'Section Sewn Paperback',
  'Spiral / Coil Bound',
  'Wire-O Bound',
  'Board Book (Cardboard Pages)',
  'Leather / Faux-Leather Bound',
];

const DEFAULT_MIME_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'application/x-mobipocket-ebook',
  'audio/mpeg',
  'audio/mp4',
  'application/vnd.comicbook+zip',
];

export function EditionScreen({ screen }: { screen: Screen }) {
  const router = useRouter();
  const isList = screen.title === 'Edition List';
  const isForm = screen.title === 'Create/Edit Edition';
  const isDetail = screen.title === 'Edition Detail';

  const [books, setBooks] = useState<Book[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [bookId, setBookId] = useState('');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [isChangingBook, setIsChangingBook] = useState(false);
  const [bookEditions, setBookEditions] = useState<Edition[]>([]);
  const [selected, setSelected] = useState<Edition | null>(null);
  const [savedEdition, setSavedEdition] = useState<Edition | null>(null);

  // Dynamic custom options with + button
  const [customTrimSizes, setCustomTrimSizes] = useState<string[]>([]);
  const [customPaperTypes, setCustomPaperTypes] = useState<string[]>([]);
  const [customBindingTypes, setCustomBindingTypes] = useState<string[]>([]);
  const [customMimeTypes, setCustomMimeTypes] = useState<string[]>([]);

  // Prompt modal for adding custom values
  const [promptModal, setPromptModal] = useState<{
    field: 'trimSize' | 'paperType' | 'bindingType' | 'digitalMimeType';
    label: string;
    placeholder: string;
  } | null>(null);
  const [promptInput, setPromptInput] = useState('');

  // Quick Add Publisher modal
  const [showNewPublisherModal, setShowNewPublisherModal] = useState(false);
  const [newPublisherName, setNewPublisherName] = useState('');
  const [newPublisherCode, setNewPublisherCode] = useState('');
  const [isSavingPublisher, setIsSavingPublisher] = useState(false);
  const [publisherModalError, setPublisherModalError] = useState('');

  // List view state
  const [rows, setRows] = useState<Edition[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('title');

  // Form state
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState(false);
  const [identifiers, setIdentifiers] = useState<Identifier[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);

  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');

  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function loadPublishersList() {
    try {
      const res = await api<{ data: Publisher[] }>('/publishers');
      setPublishers(res.data || []);
    } catch {}
  }

  function handleAddCustomValue() {
    if (!promptModal || !promptInput.trim()) return;
    const val = promptInput.trim();
    if (promptModal.field === 'trimSize') {
      setCustomTrimSizes(prev => prev.includes(val) ? prev : [...prev, val]);
      change('trimSize', val);
    } else if (promptModal.field === 'paperType') {
      setCustomPaperTypes(prev => prev.includes(val) ? prev : [...prev, val]);
      change('paperType', val);
    } else if (promptModal.field === 'bindingType') {
      setCustomBindingTypes(prev => prev.includes(val) ? prev : [...prev, val]);
      change('bindingType', val);
    } else if (promptModal.field === 'digitalMimeType') {
      setCustomMimeTypes(prev => prev.includes(val) ? prev : [...prev, val]);
      change('digitalMimeType', val);
    }
    setPromptModal(null);
    setPromptInput('');
  }

  async function handleQuickAddPublisher() {
    if (!newPublisherName.trim()) {
      setPublisherModalError('Publisher name is required.');
      return;
    }
    setIsSavingPublisher(true);
    setPublisherModalError('');
    try {
      const res = await api<{ data: { id: string } }>('/publishers', {
        method: 'POST',
        body: JSON.stringify({
          name: newPublisherName.trim(),
          code: newPublisherCode.trim() || undefined,
          status: 'active',
        }),
      });
      await loadPublishersList();
      change('publisherId', res.data.id);
      setShowNewPublisherModal(false);
      setNewPublisherName('');
      setNewPublisherCode('');
      setNotice(`Publisher "${newPublisherName.trim()}" created and selected.`);
    } catch (err: any) {
      setPublisherModalError(err?.message || 'Failed to create publisher');
    } finally {
      setIsSavingPublisher(false);
    }
  }

  async function loadList() {
    const params = new URLSearchParams({ limit: '10', offset: String(page * 10), sortBy });
    if (search) params.set('q', search);
    if (formatFilter) params.set('format', formatFilter);
    if (statusFilter) params.set('status', statusFilter);
    const result = await api<{ data: Edition[]; meta: { total: number } }>(`/editions?${params}`);
    setRows(result.data);
    setTotal(result.meta.total);
  }

  async function fetchBooks(q = '') {
    try {
      const result = await api<{ data: Book[] }>(`/books?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      setBooks(current => {
        const map = new Map<string, Book>();
        if (bookId) {
          const cur = current.find(b => b.id === bookId);
          if (cur) map.set(cur.id, cur);
        }
        for (const item of result.data) map.set(item.id, item);
        return Array.from(map.values());
      });
    } catch (err: any) {
      setError(err?.message || 'Could not fetch books');
    }
  }

  async function loadEdition(id: string) {
    const result = await api<{ data: Edition }>(`/editions/${id}`);
    setSelected(result.data);
    setBookId(result.data.book_id);
    setForm(toForm(result.data));
    if (!isForm) {
      const [ids, price] = await Promise.all([
        api<{ data: Identifier[] }>(`/editions/${id}/identifiers`),
        api<{ data: Price[] }>(`/editions/${id}/prices`),
      ]);
      setIdentifiers(ids.data);
      setPrices(price.data);
    }
  }

  function startNewEdition(targetBook?: Book | null) {
    setSelected(null);
    setEditing(false);
    setSavedEdition(null);
    let nextNum = '1';
    if (bookEditions.length > 0) {
      const nums = bookEditions.map(e => Number(e.edition_number)).filter(n => !isNaN(n));
      if (nums.length > 0) nextNum = String(Math.max(...nums) + 1);
      else nextNum = String(bookEditions.length + 1);
    }
    setForm({
      ...blank,
      editionNumber: nextNum,
      publisherId: targetBook?.publisher_id || form.publisherId || '',
    });
  }

  function selectBook(book: Book) {
    setBookId(book.id);
    setIsChangingBook(false);
    setSavedEdition(null);
    api<{ data: Edition[] }>(`/books/${book.id}/editions`)
      .then(result => {
        setBookEditions(result.data);
        startNewEdition(book);
      })
      .catch(() => setBookEditions([]));
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const wantedBook = params.get('book') || '';
    const wantedEdition = params.get('edition') || '';

    void Promise.all([
      api<{ data: Book[] }>('/books?limit=50'),
      api<{ data: Publisher[] }>('/publishers'),
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
    ]).then(async ([bookResult, publisherResult, me]) => {
      if (!active) return;
      const available = bookResult.data;
      if (wantedBook && !available.some(item => item.id === wantedBook)) {
        try {
          const single = await api<{ data: Book }>(`/books/${wantedBook}`);
          if (single?.data) available.unshift(single.data);
        } catch {}
      }
      setBooks(available);
      setPublishers(publisherResult.data);
      setRole(me.data.role);
      setPermissions(me.data.permissions);

      if (wantedEdition) {
        await loadEdition(wantedEdition);
        setEditing(isForm);
      } else if (wantedBook) {
        setBookId(wantedBook);
        const b = available.find(item => item.id === wantedBook);
        if (b) {
          const eds = await api<{ data: Edition[] }>(`/books/${wantedBook}/editions`).catch(() => ({ data: [] }));
          setBookEditions(eds.data);
          startNewEdition(b);
        }
      } else if (available[0]) {
        selectBook(available[0]);
      }
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load editions');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [screen.id]);

  useEffect(() => {
    if (isList) void loadList().catch(reason => setError(reason.message));
  }, [isList, page, search, formatFilter, statusFilter, sortBy]);

  // Debounced search when searching for books
  useEffect(() => {
    if (!bookSearchQuery.trim()) return;
    const timer = setTimeout(() => {
      void fetchBooks(bookSearchQuery.trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [bookSearchQuery]);

  async function save() {
    if (!bookId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = {
        editionCode: form.editionCode.trim() || undefined,
        editionNumber: form.editionNumber.trim(),
        revisionNumber: form.revisionNumber.trim() || null,
        releaseVersion: form.releaseVersion.trim() || null,
        editionTitle: form.editionTitle.trim() || null,
        format: form.format,
        pageCount: form.pageCount ? Number(form.pageCount) : null,
        trimSize: form.trimSize.trim() || null,
        paperType: form.paperType.trim() || null,
        paperGsm: form.paperGsm ? Number(form.paperGsm) : null,
        bindingType: form.bindingType.trim() || null,
        weightGrams: form.weightGrams ? Number(form.weightGrams) : null,
        digitalMimeType: form.digitalMimeType.trim() || null,
        accessType: form.accessType || null,
        publicationDate: form.publicationDate || null,
        status: form.status,
        publisherId: form.publisherId || null,
      };

      const result = editing && selected
        ? await api<{ data: { id: string } }>(`/editions/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ ...body, version: selected.version_no }) })
        : await api<{ data: { id: string } }>(`/books/${bookId}/editions`, { method: 'POST', body: JSON.stringify(body) });

      const reloaded = await api<{ data: Edition }>(`/editions/${result.data.id}`);
      setSelected(reloaded.data);
      setSavedEdition(reloaded.data);
      setEditing(true);
      setNotice(`Edition ${body.editionNumber} (${body.format}) saved successfully!`);

      const list = await api<{ data: Edition[] }>(`/books/${bookId}/editions`);
      setBookEditions(list.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save edition');
    } finally {
      setBusy(false);
    }
  }

  const input = (label: string, key: keyof Form, maxLength = 80, required = false) => (
    <label className="field" key={key}>
      <span>{label}{required && <span className="required-star" style={{ color: '#dc2626', marginLeft: '3px', fontWeight: 'bold' }}>*</span>}</span>
      <input className="input" value={form[key]} maxLength={maxLength} onChange={event => change(key, event.target.value)} />
    </label>
  );

  const selectedBook = books.find(b => b.id === bookId);
  const filteredSearchBooks = books.filter(b => {
    if (!bookSearchQuery.trim()) return true;
    const term = bookSearchQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(term) ||
      (b.book_code && b.book_code.toLowerCase().includes(term)) ||
      (b.primary_author && b.primary_author.toLowerCase().includes(term))
    );
  });

  return <>
    <div className="page-heading">
      <div>
        <h1 className="page-title">{screen.title}</h1>
        <p className="muted">Catalog Edition &amp; Format Management with Seamless Book Association.</p>
      </div>
      <button
        className="btn"
        onClick={() => void (isList ? loadList() : selected ? loadEdition(selected.id) : fetchBooks()).catch(reason => setError(reason.message))}
      >
        Refresh
      </button>
    </div>

    {/* Top Navigation Tabs */}
    <div className="tab-nav" style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
      <Link className={`btn ${isList ? 'btn-primary' : ''}`} href="/publishing-catalog/edition-list">
        📚 Edition Catalog List ({total > 0 ? total : rows.length})
      </Link>
      <Link
        className={`btn ${isForm && !editing ? 'btn-primary' : ''}`}
        href={`/publishing-catalog/create-edit-edition${bookId ? `?book=${bookId}` : ''}`}
        onClick={() => startNewEdition(selectedBook)}
      >
        ✨ Create Edition
      </Link>
      {isForm && editing && selected && (
        <span className="btn btn-primary" style={{ cursor: 'default' }}>
          ✏️ Edit: Edition {selected.edition_number} ({selected.format})
        </span>
      )}
      {isDetail && selected && (
        <span className="btn btn-primary" style={{ cursor: 'default' }}>
          📖 Edition Detail: Edition {selected.edition_number}
        </span>
      )}
    </div>

    {error && <p className="alert-error" role="alert">{error}</p>}
    {notice && (
      <div className="alert-success" role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span>{notice}</span>
        {savedEdition && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link className="btn btn-sm" href={`/publishing-catalog/isbn-and-identifier-register?book=${savedEdition.book_id}&edition=${savedEdition.id}`}>
              🏷️ Assign ISBN ➔
            </Link>
            <Link className="btn btn-sm" href={`/publishing-catalog/price-list-management?book=${savedEdition.book_id}&edition=${savedEdition.id}`}>
              💰 Set Pricing ➔
            </Link>
            <Link className="btn btn-sm" href={detailPath(savedEdition)}>
              👁️ View Details ➔
            </Link>
          </div>
        )}
      </div>
    )}

    {loading ? <div className="panel empty">Loading editions…</div> : isList ? <>
      <div className="catalog-list-controls">
        <input
          className="input"
          aria-label="Search editions"
          placeholder="Search by book title, edition code, format or ISBN..."
          value={searchInput}
          onChange={event => setSearchInput(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { setPage(0); setSearch(searchInput.trim()); } }}
        />
        <button className="btn" onClick={() => { setPage(0); setSearch(searchInput.trim()); }}>Search</button>
        {canCreate && <Link className="btn btn-primary" href="/publishing-catalog/create-edit-edition">Create edition</Link>}
      </div>

      <div className="panel catalog-form-grid catalog-filter-grid">
        <label className="field">
          Format
          <select className="input" value={formatFilter} onChange={event => { setPage(0); setFormatFilter(event.target.value); }}>
            <option value="">All formats</option>
            {['paperback', 'hardcover', 'ebook', 'audiobook', 'other'].map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="field">
          Status
          <select className="input" value={statusFilter} onChange={event => { setPage(0); setStatusFilter(event.target.value); }}>
            <option value="">All statuses</option>
            {['draft', 'active', 'archived'].map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="field">
          Sort
          <select className="input" value={sortBy} onChange={event => setSortBy(event.target.value)}>
            <option value="title">Book title</option>
            <option value="editionCode">Edition code</option>
            <option value="publicationDate">Publication date</option>
          </select>
        </label>
      </div>

      <div className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Book Title</th>
              <th>Edition</th>
              <th>Format</th>
              <th>ISBN</th>
              <th>Release Date</th>
              <th>Cover Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map(item => (
              <tr key={item.id}>
                <td>{item.edition_code || '—'}</td>
                <td><strong>{item.book_title}</strong></td>
                <td>Edition {item.edition_number}</td>
                <td><span className="badge">{item.format}</span></td>
                <td>{item.isbn || '—'}</td>
                <td>{day(item.publication_date)}</td>
                <td>{item.cover_price || '—'}</td>
                <td><span className={`badge ${item.status === 'active' ? 'badge-green' : item.status === 'archived' ? 'badge-amber' : ''}`}>{item.status}</span></td>
                <td>
                  <div className="button-row">
                    <Link className="btn" href={detailPath(item)}>View</Link>
                    {canUpdate && <Link className="btn" href={`/publishing-catalog/create-edit-edition?book=${item.book_id}&edition=${item.id}`}>Edit</Link>}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={9} className="empty">No editions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="catalog-pagination">
        <span>{total} editions · Page {page + 1} of {Math.max(1, Math.ceil(total / 10))}</span>
        <div className="button-row">
          <button className="btn" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button>
          <button className="btn" disabled={(page + 1) * 10 >= total} onClick={() => setPage(value => value + 1)}>Next</button>
        </div>
      </div>
    </> : <>
      {/* Seamless Book Selector Header */}
      {selectedBook && !isChangingBook ? (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px 20px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>📖</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{selectedBook.title}</h2>
                  <span className="badge badge-blue">{selectedBook.book_code || 'No code'}</span>
                  <span className={`badge ${selectedBook.publication_status === 'active' ? 'badge-green' : 'badge-amber'}`}>{selectedBook.publication_status || 'draft'}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Author: <strong>{selectedBook.primary_author || 'Unassigned'}</strong> · Publisher: <strong>{selectedBook.publisher_name || 'Unassigned'}</strong> · Category: <strong>{selectedBook.category_name || 'Unassigned'}</strong>
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => { setIsChangingBook(true); setBookSearchQuery(''); }}
                style={{ fontWeight: 600 }}
              >
                🔄 Switch Book
              </button>
              <Link className="btn btn-sm" href={`/publishing-catalog/book-detail-and-timeline?book=${selectedBook.id}`}>
                View Book ➔
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Instant Live Search Book Picker */
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', border: '1px solid #86efac', borderRadius: '10px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#166534' }}>
                🔍 Select Target Book
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#15803d' }}>
                Search and pick the book for which you want to create or edit editions.
              </p>
            </div>
            {selectedBook && (
              <button type="button" className="btn btn-sm" onClick={() => setIsChangingBook(false)}>
                Cancel / Keep "{selectedBook.title}"
              </button>
            )}
          </div>

          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              className="input"
              autoFocus
              placeholder="Type to filter books by title, code, or author..."
              value={bookSearchQuery}
              onChange={e => setBookSearchQuery(e.target.value)}
              style={{ background: '#fff', borderColor: '#86efac', fontSize: '14px', padding: '9px 12px' }}
            />
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '6px', background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            {filteredSearchBooks.length ? filteredSearchBooks.map(b => (
              <div
                key={b.id}
                onClick={() => selectBook(b)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: b.id === bookId ? '#dcfce7' : '#f8fafc',
                  border: b.id === bookId ? '1px solid #86efac' : '1px solid #e2e8f0',
                  transition: 'background 0.15s ease',
                }}
              >
                <div>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>{b.title}</strong>
                  {b.book_code && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>({b.book_code})</span>}
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Author: <strong>{b.primary_author || '—'}</strong> · Publisher: <strong>{b.publisher_name || '—'}</strong>
                  </div>
                </div>
                <button type="button" className="btn btn-sm btn-primary">
                  Select
                </button>
              </div>
            )) : (
              <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No books match "{bookSearchQuery}". Try another keyword or create a book first.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Editions Switcher Bar for the Selected Book */}
      {selectedBook && (
        <div style={{ marginBottom: '20px', padding: '14px 18px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
              Editions for this Book ({bookEditions.length}):
            </span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Click any edition pill below to edit it, or click "+ Create New Edition" to add another format.
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className={`btn btn-sm ${isForm && !editing ? 'btn-primary' : ''}`}
              style={{ fontWeight: 700 }}
              onClick={() => startNewEdition(selectedBook)}
            >
              ➕ Create New Edition
            </button>
            {bookEditions.map(ed => {
              const isSelectedEd = selected?.id === ed.id;
              return (
                <button
                  key={ed.id}
                  type="button"
                  className={`btn btn-sm ${isSelectedEd ? 'btn-primary' : ''}`}
                  onClick={() => {
                    void loadEdition(ed.id);
                    setEditing(isForm);
                  }}
                  style={{ fontWeight: isSelectedEd ? 700 : 500 }}
                >
                  Edition {ed.edition_number} · {ed.format}
                  <span className="badge" style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 5px' }}>
                    {ed.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isForm ? (
        <section className="panel catalog-form">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              {editing
                ? `✏️ Edit Edition: Edition ${form.editionNumber} (${form.format})`
                : `✨ Create New Edition for "${selectedBook?.title || 'Selected Book'}"`}
            </h2>
            {editing && selected && (
              <span className="badge badge-blue">
                Version #{selected.version_no}
              </span>
            )}
          </div>

          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '14px 0 8px', color: '#334155' }}>Core Identity</h3>
          <div className="catalog-form-grid">
            {input('Edition code (leave blank to auto-generate)', 'editionCode')}
            {input('Edition number', 'editionNumber', 40, true)}
            {input('Revision number', 'revisionNumber', 40)}
            {input('Release version', 'releaseVersion', 40)}
            {input('Edition title (optional custom subtitle)', 'editionTitle', 500)}
            <label className="field">
              <span>Format <span className="required-star" style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span></span>
              <select className="input" value={form.format} onChange={event => change('format', event.target.value)}>
                {['paperback', 'hardcover', 'ebook', 'audiobook', 'other'].map(value => (
                  <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Publication date</span>
              <input className="input" type="date" value={form.publicationDate} onChange={event => change('publicationDate', event.target.value)} />
            </label>
            <label className="field">
              <span style={{ fontWeight: 600 }}>Publisher</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  className="input"
                  value={form.publisherId}
                  onChange={event => change('publisherId', event.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Use book publisher ({selectedBook?.publisher_name || 'None'})</option>
                  {publishers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => { setShowNewPublisherModal(true); setPublisherModalError(''); }}
                  title="Create new publisher"
                  style={{ whiteSpace: 'nowrap', padding: '7px 11px', fontWeight: 700 }}
                >
                  ➕ New
                </button>
              </div>
            </label>
            <label className="field">
              <span>Status <span className="required-star" style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span></span>
              <select className="input" value={form.status} onChange={event => change('status', event.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active (Published)</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          {['paperback', 'hardcover', 'other'].includes(form.format) ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#334155' }}>
                  Physical Specification
                </h3>
                {/* 1-Click Specification Presets */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Quick Presets:</span>
                  {PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      className="btn btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => {
                        setForm(cur => ({
                          ...cur,
                          format: p.format,
                          trimSize: p.trimSize,
                          paperType: p.paperType,
                          paperGsm: p.paperGsm,
                          bindingType: p.bindingType,
                        }));
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="catalog-form-grid">
                <label className="field">
                  <span>Page count {form.status === 'active' && <span className="required-star" style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>}</span>
                  <input className="input" type="number" min="1" placeholder="e.g. 256" value={form.pageCount} onChange={event => change('pageCount', event.target.value)} />
                </label>

                <label className="field">
                  <span style={{ fontWeight: 600 }}>Trim size</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      className="input"
                      value={form.trimSize}
                      onChange={e => change('trimSize', e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select or add trim size...</option>
                      {Array.from(new Set([...DEFAULT_TRIM_SIZES, ...customTrimSizes, ...(form.trimSize ? [form.trimSize] : [])])).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setPromptModal({
                          field: 'trimSize',
                          label: 'Custom Trim Size',
                          placeholder: 'e.g. 8" x 8" or 140mm x 210mm',
                        });
                        setPromptInput('');
                      }}
                      title="Add custom trim size"
                      style={{ whiteSpace: 'nowrap', padding: '7px 11px', fontWeight: 700 }}
                    >
                      ➕
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span style={{ fontWeight: 600 }}>Paper type</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      className="input"
                      value={form.paperType}
                      onChange={e => change('paperType', e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select or add paper type...</option>
                      {Array.from(new Set([...DEFAULT_PAPER_TYPES, ...customPaperTypes, ...(form.paperType ? [form.paperType] : [])])).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setPromptModal({
                          field: 'paperType',
                          label: 'Custom Paper Type',
                          placeholder: 'e.g. 85 GSM Imported Bible Paper',
                        });
                        setPromptInput('');
                      }}
                      title="Add custom paper type"
                      style={{ whiteSpace: 'nowrap', padding: '7px 11px', fontWeight: 700 }}
                    >
                      ➕
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span>Paper GSM</span>
                  <input className="input" type="number" min="1" step="0.01" placeholder="e.g. 70" value={form.paperGsm} onChange={event => change('paperGsm', event.target.value)} />
                </label>

                <label className="field">
                  <span style={{ fontWeight: 600 }}>Binding type</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      className="input"
                      value={form.bindingType}
                      onChange={e => change('bindingType', e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select or add binding type...</option>
                      {Array.from(new Set([...DEFAULT_BINDING_TYPES, ...customBindingTypes, ...(form.bindingType ? [form.bindingType] : [])])).map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setPromptModal({
                          field: 'bindingType',
                          label: 'Custom Binding Type',
                          placeholder: 'e.g. Japanese Stab Binding or Concealed Wire-O',
                        });
                        setPromptInput('');
                      }}
                      title="Add custom binding type"
                      style={{ whiteSpace: 'nowrap', padding: '7px 11px', fontWeight: 700 }}
                    >
                      ➕
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span>Weight (grams)</span>
                  <input className="input" type="number" min="1" step="0.01" placeholder="e.g. 350" value={form.weightGrams} onChange={event => change('weightGrams', event.target.value)} />
                </label>
              </div>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '20px 0 8px', color: '#334155' }}>Digital Metadata</h3>
              <div className="catalog-form-grid">
                <label className="field">
                  <span style={{ fontWeight: 600 }}>Digital MIME type</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      className="input"
                      value={form.digitalMimeType}
                      onChange={e => change('digitalMimeType', e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select or add MIME type...</option>
                      {Array.from(new Set([...DEFAULT_MIME_TYPES, ...customMimeTypes, ...(form.digitalMimeType ? [form.digitalMimeType] : [])])).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setPromptModal({
                          field: 'digitalMimeType',
                          label: 'Custom Digital MIME Type',
                          placeholder: 'e.g. application/vnd.amazon.mobi8-ebook',
                        });
                        setPromptInput('');
                      }}
                      title="Add custom MIME type"
                      style={{ whiteSpace: 'nowrap', padding: '7px 11px', fontWeight: 700 }}
                    >
                      ➕
                    </button>
                  </div>
                </label>
                <label className="field">
                  <span>Access type</span>
                  <select className="input" value={form.accessType} onChange={event => change('accessType', event.target.value)}>
                    <option value="">Not set</option>
                    <option value="private">Private</option>
                    <option value="licensed">Licensed</option>
                    <option value="public">Public Domain</option>
                  </select>
                </label>
              </div>
            </>
          )}

          <div className="button-row" style={{ marginTop: '22px' }}>
            {(editing ? canUpdate : canCreate) && (
              <button
                className="btn btn-primary"
                disabled={busy || !bookId || !form.editionNumber.trim()}
                onClick={() => void save()}
              >
                {busy ? 'Saving…' : editing ? 'Save Edition Changes' : 'Create Edition'}
              </button>
            )}
            {selected && (
              <Link className="btn" href={detailPath(selected)}>
                View Edition Details
              </Link>
            )}
            <Link className="btn" href="/publishing-catalog/edition-list">
              Cancel
            </Link>
          </div>
        </section>
      ) : selected ? <>
        {/* Edition Detail View */}
        <section className="panel catalog-form">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              {selected.book_title || selectedBook?.title} · Edition {selected.edition_number} ({selected.format})
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {canUpdate && (
                <Link className="btn btn-primary" href={`/publishing-catalog/create-edit-edition?book=${selected.book_id}&edition=${selected.id}`}>
                  ✏️ Edit Edition
                </Link>
              )}
            </div>
          </div>

          <div className="catalog-form-grid">
            <p>Code: <strong>{selected.edition_code || '—'}</strong></p>
            <p>Format: <strong>{selected.format}</strong></p>
            <p>Revision: <strong>{selected.revision_number || '—'}</strong></p>
            <p>Release version: <strong>{selected.release_version || '—'}</strong></p>
            <p>Publication date: <strong>{day(selected.publication_date)}</strong></p>
            <p>Pages: <strong>{selected.page_count ?? '—'}</strong></p>
            <p>Trim size: <strong>{selected.trim_size || '—'}</strong></p>
            <p>Paper: <strong>{selected.paper_type || '—'}{selected.paper_gsm ? ` (${selected.paper_gsm} GSM)` : ''}</strong></p>
            <p>Binding: <strong>{selected.binding_type || '—'}</strong></p>
            <p>Digital type: <strong>{selected.digital_mime_type || '—'}</strong></p>
            <p>Access: <strong>{selected.access_type || '—'}</strong></p>
            <p>Status: <span className={`badge ${selected.status === 'active' ? 'badge-green' : 'badge-amber'}`}>{selected.status}</span></p>
          </div>

          <div className="button-row" style={{ marginTop: '16px' }}>
            <Link className="btn" href={`/publishing-catalog/book-detail-and-timeline?book=${selected.book_id}`}>
              Parent Book Details
            </Link>
            <Link className="btn" href={`/publishing-catalog/isbn-and-identifier-register?book=${selected.book_id}&edition=${selected.id}`}>
              🏷️ ISBN &amp; Identifiers ({identifiers.length})
            </Link>
            <Link className="btn" href={`/publishing-catalog/price-list-management?book=${selected.book_id}&edition=${selected.id}`}>
              💰 Price Lists ({prices.length})
            </Link>
          </div>
        </section>

        <section className="panel catalog-form">
          <h2 className="section-title">Registered Identifiers (ISBN / Barcode)</h2>
          {identifiers.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Identifier Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {identifiers.map(id => (
                    <tr key={id.id}>
                      <td><strong>{id.identifier_type}</strong></td>
                      <td><code>{id.identifier_value}</code></td>
                      <td><span className="badge badge-green">{id.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">
              No identifiers registered yet. <Link href={`/publishing-catalog/isbn-and-identifier-register?book=${selected.book_id}&edition=${selected.id}`}>Assign an ISBN now ➔</Link>
            </p>
          )}
        </section>

        <section className="panel catalog-form">
          <h2 className="section-title">Price History &amp; Commercial Pricing</h2>
          {prices.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Price Type</th>
                    <th>Amount</th>
                    <th>Validity Period</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map(price => (
                    <tr key={price.id}>
                      <td>{price.price_type}</td>
                      <td><strong>{price.currency_code} {price.amount}</strong></td>
                      <td>{day(price.effective_from)} to {day(price.effective_to)}</td>
                      <td><span className="badge badge-green">{price.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">
              No prices recorded yet. <Link href={`/publishing-catalog/price-list-management?book=${selected.book_id}&edition=${selected.id}`}>Set retail cover price ➔</Link>
            </p>
          )}
        </section>
      </> : (
        <div className="panel empty">
          Select an edition to view its details, or click "+ Create New Edition" above.
        </div>
      )}
    </>}

    {/* Prompt Modal for Custom Specification Field */}
    {promptModal && (
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
        onClick={e => {
          if (e.target === e.currentTarget) setPromptModal(null);
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              ➕ Add {promptModal.label}
            </h3>
            <button
              type="button"
              onClick={() => setPromptModal(null)}
              style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          <label className="field" style={{ marginBottom: '16px' }}>
            <span>Enter value</span>
            <input
              className="input"
              autoFocus
              placeholder={promptModal.placeholder}
              value={promptInput}
              onChange={e => setPromptInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomValue();
                }
              }}
            />
          </label>

          <div className="button-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn" onClick={() => setPromptModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!promptInput.trim()}
              onClick={handleAddCustomValue}
            >
              Add &amp; Select
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Quick Add Publisher Modal */}
    {showNewPublisherModal && (
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
        onClick={e => {
          if (e.target === e.currentTarget) setShowNewPublisherModal(false);
        }}
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
              ➕ Create New Publisher
            </h3>
            <button
              type="button"
              onClick={() => setShowNewPublisherModal(false)}
              style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
            Register a publishing company or imprint in the catalog directory.
          </p>

          {publisherModalError && (
            <div className="alert-error" style={{ marginBottom: '14px', fontSize: '13px' }}>
              {publisherModalError}
            </div>
          )}

          <div style={{ display: 'grid', gap: '12px' }}>
            <label className="field">
              <span>Publisher Name <span style={{ color: '#dc2626' }}>*</span></span>
              <input
                className="input"
                autoFocus
                placeholder="e.g. Somoy Prokashon, Penguin Random House"
                value={newPublisherName}
                onChange={e => setNewPublisherName(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Publisher Code (optional, letters/numbers)</span>
              <input
                className="input"
                placeholder="e.g. SOMOY-PUB"
                value={newPublisherCode}
                onChange={e => setNewPublisherCode(e.target.value)}
              />
            </label>
          </div>

          <div className="button-row" style={{ marginTop: '20px', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setShowNewPublisherModal(false)}
              disabled={isSavingPublisher}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSavingPublisher || !newPublisherName.trim()}
              onClick={() => void handleQuickAddPublisher()}
            >
              {isSavingPublisher ? 'Creating…' : 'Save & Select Publisher'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>;
}
