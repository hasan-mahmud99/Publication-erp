"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Book = {
  id: string;
  title: string;
  book_code: string | null;
  primary_author?: string | null;
  publisher_name?: string | null;
  category_name?: string | null;
};

type Edition = {
  id: string;
  book_id: string;
  book_title: string;
  edition_code: string | null;
  edition_number: string;
  edition_title: string | null;
  format: 'ebook' | 'audiobook';
  digital_mime_type: string | null;
  access_type: string | null;
  release_version: string | null;
  publication_date: string | null;
  status: string;
  version_no: number;
  isbn: string | null;
};

type Asset = {
  id: string;
  version_no: number;
  file_name: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  status: string;
  uploaded_at: string;
};

type Form = {
  bookId: string;
  editionNumber: string;
  editionTitle: string;
  format: 'ebook' | 'audiobook';
  digitalMimeType: string;
  accessType: string;
  releaseVersion: string;
  publicationDate: string;
  status: string;
};

const DEFAULT_MIME_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'application/x-mobipocket-ebook',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'application/vnd.comicbook+zip',
];

const DEFAULT_ACCESS_TYPES = [
  { value: 'private', label: 'Private (Protected Download)' },
  { value: 'licensed', label: 'Licensed Access (DRM / Key)' },
  { value: 'public', label: 'Public Metadata / Open Access' },
];

const blank: Form = {
  bookId: '',
  editionNumber: '1',
  editionTitle: '',
  format: 'ebook',
  digitalMimeType: 'application/pdf',
  accessType: 'private',
  releaseVersion: '1.0',
  publicationDate: '',
  status: 'draft',
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
};

export function DigitalFormatScreen({ screen }: { screen: Screen }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [selected, setSelected] = useState<Edition | null>(null);

  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [isChangingBook, setIsChangingBook] = useState(false);

  const [customMimeTypes, setCustomMimeTypes] = useState<string[]>([]);
  const [showCustomMimeModal, setShowCustomMimeModal] = useState(false);
  const [newMimeInput, setNewMimeInput] = useState('');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');

  const selectedBook = books.find(b => b.id === form.bookId);

  const filteredSearchBooks = books.filter(b => {
    if (!bookSearchQuery.trim()) return true;
    const q = bookSearchQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      (b.book_code && b.book_code.toLowerCase().includes(q)) ||
      (b.primary_author && b.primary_author.toLowerCase().includes(q))
    );
  });

  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [bookResult, pdfResult, audioResult, me] = await Promise.all([
        api<{ data: Book[] }>('/books?limit=100'),
        api<{ data: Edition[] }>(`/editions?format=ebook&limit=100&q=${encodeURIComponent(search)}`),
        api<{ data: Edition[] }>(`/editions?format=audiobook&limit=100&q=${encodeURIComponent(search)}`),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);
      setBooks(bookResult.data);
      setEditions([...pdfResult.data, ...audioResult.data].sort((a, b) => a.book_title.localeCompare(b.book_title)));
      setRole(me.data.role);
      setPermissions(me.data.permissions);
      setForm(current => ({ ...current, bookId: current.bookId || bookResult.data[0]?.id || '' }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load digital editions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [screen.id, search]);

  function edit(item: Edition) {
    setSelected(item);
    setFile(null);
    setIsChangingBook(false);
    void api<{ data: Asset[] }>(`/catalog/digital-assets?editionId=${item.id}`)
      .then(result => setAssets(result.data))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load asset versions'));
    setForm({
      bookId: item.book_id,
      editionNumber: item.edition_number,
      editionTitle: item.edition_title || '',
      format: item.format,
      digitalMimeType: item.digital_mime_type || '',
      accessType: item.access_type || 'private',
      releaseVersion: item.release_version || '',
      publicationDate: item.publication_date ? String(item.publication_date).slice(0, 10) : '',
      status: item.status,
    });
  }

  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = {
        editionNumber: form.editionNumber.trim(),
        editionTitle: form.editionTitle.trim() || null,
        format: form.format,
        digitalMimeType: form.digitalMimeType.trim() || null,
        accessType: form.accessType,
        releaseVersion: form.releaseVersion.trim() || null,
        publicationDate: form.publicationDate || null,
        status: form.status,
      };
      if (selected) {
        await api(`/editions/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ ...body, version: selected.version_no }) });
      } else {
        await api(`/books/${form.bookId}/editions`, { method: 'POST', body: JSON.stringify(body) });
      }
      setSelected(null);
      setForm({ ...blank, bookId: form.bookId });
      setNotice('Digital edition metadata saved successfully.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save digital edition');
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!selected || !file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (file.size > 6000000) throw new Error('File must be 6 MB or smaller');
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      await api('/catalog/digital-assets', {
        method: 'POST',
        body: JSON.stringify({ editionId: selected.id, fileName: file.name, base64 }),
      });
      const result = await api<{ data: Asset[] }>(`/catalog/digital-assets?editionId=${selected.id}`);
      setAssets(result.data);
      setFile(null);
      setNotice('Private asset version uploaded successfully.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Asset upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function download(asset: Asset) {
    setBusy(true);
    setError('');
    try {
      const blob = await apiFile(`/catalog/digital-assets/${asset.id}/download`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = asset.file_name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Asset download failed');
    } finally {
      setBusy(false);
    }
  }

  const allMimeTypes = Array.from(new Set([...DEFAULT_MIME_TYPES, ...customMimeTypes, ...(form.digitalMimeType ? [form.digitalMimeType] : [])]));

  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Digital edition registry linked to Book Master, with format, MIME type, and DRM access management.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn" onClick={() => void load()}>
            Refresh
          </button>
          <Link className="btn" href="/publishing-catalog/book-catalog-list">
            Open Book Catalog ➔
          </Link>
        </div>
      </div>

      {error && <div className="alert-error" role="alert" style={{ marginBottom: '14px' }}>{error}</div>}
      {notice && <div className="alert-success" role="status" style={{ marginBottom: '14px' }}>{notice}</div>}

      <div className="catalog-list-controls">
        <input
          className="input"
          aria-label="Search digital editions"
          placeholder="Search by book title or edition code..."
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') setSearch(query.trim());
          }}
        />
        <button className="btn" onClick={() => setSearch(query.trim())}>
          Search
        </button>
      </div>

      <div className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Book Title</th>
              <th>Edition</th>
              <th>Format</th>
              <th>MIME Type</th>
              <th>Access Tier</th>
              <th>Release Version</th>
              <th>Publication Date</th>
              <th>ISBN</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {editions.length ? (
              editions.map(item => (
                <tr key={item.id} style={{ background: item.id === selected?.id ? '#fef9c3' : undefined }}>
                  <td>
                    <strong style={{ color: '#0f172a' }}>{item.book_title}</strong>
                  </td>
                  <td>{item.edition_code || `Ed #${item.edition_number}`}</td>
                  <td>
                    <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>
                      {item.format}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: '11px' }}>{item.digital_mime_type || '—'}</code>
                  </td>
                  <td>
                    <span className="badge badge-slate" style={{ textTransform: 'capitalize' }}>
                      {item.access_type || '—'}
                    </span>
                  </td>
                  <td>{item.release_version || '—'}</td>
                  <td>{item.publication_date ? String(item.publication_date).slice(0, 10) : '—'}</td>
                  <td>{item.isbn || '—'}</td>
                  <td>
                    <span className={`badge ${item.status === 'active' ? 'badge-green' : 'badge-amber'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="button-row" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                      <Link className="btn btn-sm" href={`/publishing-catalog/edition-detail?book=${item.book_id}&edition=${item.id}`}>
                        Details
                      </Link>
                      {canUpdate && (
                        <button className="btn btn-sm btn-primary" onClick={() => edit(item)}>
                          Manage Assets
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty" colSpan={10}>
                  {loading ? 'Loading digital editions…' : 'No digital editions match this search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Register / Edit Digital Edition */}
      {(canCreate || (selected && canUpdate)) && (
        <section className="panel catalog-form" style={{ marginTop: '22px', borderTop: '3px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              {selected ? `✏️ Edit Digital Edition: ${selected.book_title}` : '➕ Register New Digital Edition'}
            </h2>
            {selected && (
              <span className="badge badge-blue">
                Version #{selected.version_no}
              </span>
            )}
          </div>

          {/* Seamless Book Selector for New Digital Edition */}
          {!selected && (
            <div style={{ marginBottom: '16px' }}>
              {selectedBook && !isChangingBook ? (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>📖 {selectedBook.title}</strong>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Author: {selectedBook.primary_author || '—'} · Publisher: {selectedBook.publisher_name || '—'}
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => setIsChangingBook(true)}>
                    🔄 Switch Book
                  </button>
                </div>
              ) : (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <input
                    className="input"
                    placeholder="Search book to associate digital format..."
                    value={bookSearchQuery}
                    onChange={e => setBookSearchQuery(e.target.value)}
                    style={{ marginBottom: '8px' }}
                  />
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'grid', gap: '4px' }}>
                    {filteredSearchBooks.map(b => (
                      <div
                        key={b.id}
                        onClick={() => { change('bookId', b.id); setIsChangingBook(false); }}
                        style={{ padding: '6px 10px', background: b.id === form.bookId ? '#dcfce7' : '#ffffff', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{b.title}</span>
                        <span style={{ fontSize: '11px', color: '#15803d' }}>Select</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="catalog-form-grid">
            <label className="field">
              <span style={{ fontWeight: 600 }}>
                Format <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <select
                className="input"
                value={form.format}
                onChange={event => {
                  const format = event.target.value as Form['format'];
                  setForm(current => ({
                    ...current,
                    format,
                    digitalMimeType: format === 'ebook' ? 'application/pdf' : 'audio/mpeg',
                  }));
                }}
              >
                <option value="ebook">E-Book (PDF / EPUB / MOBI)</option>
                <option value="audiobook">Audiobook (MP3 / M4A / AAC)</option>
              </select>
            </label>

            <label className="field">
              <span>Edition Number <span style={{ color: '#dc2626' }}>*</span></span>
              <input className="input" value={form.editionNumber} onChange={event => change('editionNumber', event.target.value)} />
            </label>

            <label className="field">
              <span>Edition Custom Title</span>
              <input className="input" placeholder="e.g. Illustrated E-Book Edition" value={form.editionTitle} onChange={event => change('editionTitle', event.target.value)} />
            </label>

            {/* MIME Type with PLUS Button */}
            <label className="field">
              <span style={{ fontWeight: 600 }}>
                MIME Type <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  className="input"
                  value={form.digitalMimeType}
                  onChange={event => change('digitalMimeType', event.target.value)}
                  style={{ flex: 1 }}
                >
                  {allMimeTypes.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => { setShowCustomMimeModal(true); setNewMimeInput(''); }}
                  title="Add custom MIME type"
                  style={{ whiteSpace: 'nowrap', padding: '7px 11px', fontWeight: 700 }}
                >
                  ➕
                </button>
              </div>
            </label>

            <label className="field">
              <span>Access Policy</span>
              <select className="input" value={form.accessType} onChange={event => change('accessType', event.target.value)}>
                {DEFAULT_ACCESS_TYPES.map(a => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Release Version</span>
              <input className="input" value={form.releaseVersion} onChange={event => change('releaseVersion', event.target.value)} />
            </label>

            <label className="field">
              <span>Release Date</span>
              <input className="input" type="date" value={form.publicationDate} onChange={event => change('publicationDate', event.target.value)} />
            </label>

            <label className="field">
              <span>Status</span>
              <select className="input" value={form.status} onChange={event => change('status', event.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active (Published)</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <div className="button-row" style={{ marginTop: '16px' }}>
            <button
              className="btn btn-primary"
              disabled={busy || !form.bookId || !form.editionNumber.trim()}
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : selected ? 'Save Metadata Changes' : 'Register Digital Edition'}
            </button>
            {selected && (
              <button
                className="btn"
                onClick={() => {
                  setSelected(null);
                  setForm({ ...blank, bookId: form.bookId });
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </section>
      )}

      {/* Protected Digital Asset Versions */}
      {selected && canUpdate && (
        <section className="panel catalog-form" style={{ marginTop: '22px', borderTop: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Protected Digital Assets: {selected.book_title} (Ed #{selected.edition_number})
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Maximum file size: <strong>6 MB</strong> · SHA-256 verified
            </span>
          </div>

          <p className="muted" style={{ margin: '0 0 16px', fontSize: '13px' }}>
            Store encrypted or protected manuscript files (PDF, EPUB, MP3, WAV). Uploading a new file automatically provisions the next version number.
          </p>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              className="input"
              type="file"
              accept=".pdf,.epub,.mp3,.wav"
              onChange={event => setFile(event.target.files?.[0] || null)}
              style={{ maxWidth: '320px' }}
            />
            <button
              className="btn btn-primary"
              disabled={busy || !file}
              onClick={() => void upload()}
            >
              {busy ? 'Uploading…' : 'Upload Asset Version'}
            </button>
            {file && (
              <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                Selected: {file.name} ({formatBytes(file.size)})
              </span>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>File Name</th>
                  <th>Media Type</th>
                  <th>File Size</th>
                  <th>Checksum (SHA-256)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.length ? (
                  assets.map(asset => (
                    <tr key={asset.id}>
                      <td>
                        <span className="badge badge-blue">v{asset.version_no}</span>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{asset.file_name}</strong>
                      </td>
                      <td>
                        <code style={{ fontSize: '11px' }}>{asset.media_type}</code>
                      </td>
                      <td>{formatBytes(asset.size_bytes)}</td>
                      <td>
                        <code style={{ fontSize: '11px', color: '#64748b' }}>{asset.sha256.slice(0, 16)}…</code>
                      </td>
                      <td>
                        <span className="badge badge-green">{asset.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm" onClick={() => void download(asset)}>
                          Download
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="empty">
                      No private asset versions uploaded yet for this edition.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal: Custom MIME Type */}
      {showCustomMimeModal && (
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
          onClick={e => { if (e.target === e.currentTarget) setShowCustomMimeModal(false); }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                ➕ Add Custom MIME Type
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomMimeModal(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <label className="field" style={{ marginBottom: '16px' }}>
              <span>MIME Type String</span>
              <input
                className="input"
                autoFocus
                placeholder="e.g. application/x-ibooks+zip"
                value={newMimeInput}
                onChange={e => setNewMimeInput(e.target.value.trim().toLowerCase())}
              />
            </label>
            <div className="button-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn" onClick={() => setShowCustomMimeModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!newMimeInput.trim()}
                onClick={() => {
                  const val = newMimeInput.trim();
                  if (val && !customMimeTypes.includes(val)) {
                    setCustomMimeTypes(prev => [...prev, val]);
                  }
                  change('digitalMimeType', val);
                  setShowCustomMimeModal(false);
                }}
              >
                Add &amp; Select
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
