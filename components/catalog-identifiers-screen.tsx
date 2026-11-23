"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Book = {
  id: string;
  title: string;
  book_code: string | null;
  publisher_name?: string | null;
  primary_author?: string | null;
  category_name?: string | null;
  publication_status?: string | null;
  edition_count?: number;
};

type Edition = {
  id: string;
  book_id: string;
  edition_number: string;
  format: string;
  edition_code: string | null;
  status: string;
  publication_date: string | null;
};

type Identifier = {
  id: string;
  book_id: string;
  book_title: string;
  edition_id: string;
  edition_code: string | null;
  edition_number: string;
  format: string;
  identifier_type: string;
  identifier_value: string;
  source: string | null;
  issue_date: string | null;
  status: string;
};

type Validation = {
  id: string;
  previous_status: string;
  new_status: string;
  comment: string;
  occurred_at: string;
};

const DEFAULT_IDENTIFIER_TYPES = ['ISBN', 'SKU', 'BARCODE', 'DOI', 'GTIN-13', 'OTHER'];
const day = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : '—');

export function CatalogIdentifiersScreen({ screen }: { screen: Screen }) {
  const router = useRouter();
  const isQueue = screen.title === 'Identifier Validation Queue';

  // Book & Edition selector state
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [isChangingBook, setIsChangingBook] = useState(false);

  const [editions, setEditions] = useState<Edition[]>([]);
  const [editionId, setEditionId] = useState('');

  // Identifiers list state
  const [rows, setRows] = useState<Identifier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(isQueue ? 'pending' : '');

  // Form state
  const [type, setType] = useState('ISBN');
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [showCustomTypeModal, setShowCustomTypeModal] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState('');

  const [value, setValue] = useState('');
  const [source, setSource] = useState('');
  const [issueDate, setIssueDate] = useState('');

  // Validation / Review state
  const [selected, setSelected] = useState<Identifier | null>(null);
  const [history, setHistory] = useState<Validation[]>([]);
  const [decision, setDecision] = useState('validated');
  const [comment, setComment] = useState('');

  // Permissions & UI states
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canApprove = role === 'Owner' || permissions.includes('workspace.approve');
  const canExport = role === 'Owner' || permissions.includes('exports.create');

  const selectedBook = books.find(b => b.id === bookId);
  const selectedEdition = editions.find(e => e.id === editionId);

  const filteredSearchBooks = books.filter(b => {
    if (!bookSearchQuery.trim()) return true;
    const q = bookSearchQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      (b.book_code && b.book_code.toLowerCase().includes(q)) ||
      (b.primary_author && b.primary_author.toLowerCase().includes(q)) ||
      (b.category_name && b.category_name.toLowerCase().includes(q))
    );
  });

  async function loadRows() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      const result = await api<{ data: Identifier[]; meta: { total: number } }>(`/identifiers?${params}`);
      setRows(result.data);
      setTotal(result.meta.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load identifiers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, [screen.id, page, query, status]);

  // Initial books & user load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantedBook = params.get('book') || '';
    const wantedEdition = params.get('edition') || '';

    Promise.all([
      api<{ data: Book[] }>('/books?limit=100'),
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
    ])
      .then(async ([bookResult, me]) => {
        const available = bookResult.data || [];
        if (wantedBook && !available.some(item => item.id === wantedBook)) {
          try {
            const single = await api<{ data: Book }>(`/books/${wantedBook}`);
            if (single?.data) available.unshift(single.data);
          } catch {}
        }
        setBooks(available);
        setRole(me.data.role);
        setPermissions(me.data.permissions);

        const initialBookId = wantedBook || available[0]?.id || '';
        setBookId(initialBookId);

        if (initialBookId) {
          const edRes = await api<{ data: Edition[] }>(`/books/${initialBookId}/editions`);
          const eds = edRes.data || [];
          setEditions(eds);
          const initialEdId = wantedEdition && eds.some(e => e.id === wantedEdition) ? wantedEdition : eds[0]?.id || '';
          setEditionId(initialEdId);
        }
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load catalog books'));
  }, [screen.id]);

  async function handleSelectBook(b: Book) {
    setBookId(b.id);
    setIsChangingBook(false);
    setError('');
    setNotice('');
    try {
      const edRes = await api<{ data: Edition[] }>(`/books/${b.id}/editions`);
      const eds = edRes.data || [];
      setEditions(eds);
      const firstEdId = eds[0]?.id || '';
      setEditionId(firstEdId);
      router.replace(`/publishing-catalog/isbn-and-identifier-register?book=${b.id}${firstEdId ? `&edition=${firstEdId}` : ''}`);
    } catch (err: any) {
      setError(err?.message || 'Could not load editions for this book');
    }
  }

  function handleSelectEdition(eId: string) {
    setEditionId(eId);
    setError('');
    router.replace(`/publishing-catalog/isbn-and-identifier-register?book=${bookId}&edition=${eId}`);
  }

  async function select(item: Identifier) {
    setSelected(item);
    setComment('');
    try {
      const result = await api<{ data: Validation[] }>(`/identifiers/${item.id}/validations`);
      setHistory(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load validation history');
    }
  }

  async function act(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      setNotice(message);
      await loadRows();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true);
    setError('');
    try {
      const blob = await apiFile('/catalog/export.csv?type=identifiers');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'catalog-identifiers.csv';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  const allIdentifierTypes = Array.from(new Set([...DEFAULT_IDENTIFIER_TYPES, ...customTypes]));

  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            {isQueue
              ? 'Review submitted identifiers and record internal assignment decisions.'
              : 'Register edition-specific ISBN and other publication identifiers.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" className="btn" onClick={() => void loadRows()}>
            Refresh
          </button>
          <Link className="btn" href="/publishing-catalog/book-catalog-list">
            Open Book Catalog ➔
          </Link>
        </div>
      </div>

      {error && <div className="alert-error" role="alert" style={{ marginBottom: '14px' }}>{error}</div>}
      {notice && <div className="alert-success" role="status" style={{ marginBottom: '14px' }}>{notice}</div>}

      {/* Book & Edition Selector (When Registering Identifiers) */}
      {!isQueue && (
        <>
          {selectedBook && !isChangingBook ? (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '16px 20px',
                marginBottom: '18px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '32px' }}>📖</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                        {selectedBook.title}
                      </h2>
                      {selectedBook.book_code && (
                        <span className="badge badge-blue">{selectedBook.book_code}</span>
                      )}
                      <span className={`badge ${selectedBook.publication_status === 'active' ? 'badge-green' : 'badge-amber'}`}>
                        {selectedBook.publication_status || 'draft'}
                      </span>
                    </div>
                    <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#64748b' }}>
                      Author: <strong style={{ color: '#0f172a' }}>{selectedBook.primary_author || '—'}</strong> ·
                      Publisher: <strong>{selectedBook.publisher_name || '—'}</strong> ·
                      Category: <strong>{selectedBook.category_name || '—'}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setIsChangingBook(true);
                      setBookSearchQuery('');
                    }}
                    style={{ fontWeight: 600 }}
                  >
                    🔄 Switch Book
                  </button>
                  <Link
                    className="btn btn-sm"
                    href={`/publishing-catalog/book-detail-and-timeline?book=${selectedBook.id}`}
                  >
                    Book Detail ➔
                  </Link>
                  <Link
                    className="btn btn-sm"
                    href={`/publishing-catalog/create-edit-edition?book=${selectedBook.id}`}
                  >
                    Manage Editions ➔
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                border: '1px solid #86efac',
                borderRadius: '10px',
                padding: '18px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                    🔍 Select Book for Identifier Assignment
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#15803d' }}>
                    Select a book to assign an official ISBN, barcode, or SKU to one of its editions.
                  </p>
                </div>
                {selectedBook && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setIsChangingBook(false)}
                  >
                    Cancel / Keep "{selectedBook.title}"
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  className="input"
                  autoFocus
                  placeholder="Type to filter books by title, code, author, or category..."
                  value={bookSearchQuery}
                  onChange={e => setBookSearchQuery(e.target.value)}
                  style={{ background: '#fff', borderColor: '#86efac', fontSize: '14px', padding: '9px 12px' }}
                />
              </div>

              <div
                style={{
                  maxHeight: '230px',
                  overflowY: 'auto',
                  display: 'grid',
                  gap: '6px',
                  background: '#ffffff',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                }}
              >
                {filteredSearchBooks.length ? (
                  filteredSearchBooks.map(b => (
                    <div
                      key={b.id}
                      onClick={() => void handleSelectBook(b)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: b.id === bookId ? '#dcfce7' : '#f8fafc',
                        border: b.id === bookId ? '1px solid #86efac' : '1px solid #e2e8f0',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{b.title}</strong>
                        {b.book_code && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>({b.book_code})</span>
                        )}
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Author: <strong>{b.primary_author || '—'}</strong> ·
                          Publisher: <strong>{b.publisher_name || '—'}</strong>
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm btn-primary">
                        Select
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    No books found matching "{bookSearchQuery}".
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Edition Switcher Pill Bar */}
          {selectedBook && (
            <div
              style={{
                marginBottom: '20px',
                padding: '14px 18px',
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
                  Target Edition for ISBN Registration:
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Each format / edition requires its own unique ISBN according to international standards.
                </span>
              </div>

              {editions.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  {editions.map(ed => {
                    const isSelected = ed.id === editionId;
                    return (
                      <button
                        key={ed.id}
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : ''}`}
                        onClick={() => handleSelectEdition(ed.id)}
                        style={{ fontWeight: isSelected ? 700 : 500 }}
                      >
                        Edition {ed.edition_number} · {ed.format}
                        <span className="badge" style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 5px' }}>
                          {ed.status}
                        </span>
                      </button>
                    );
                  })}
                  <Link
                    className="btn btn-sm"
                    href={`/publishing-catalog/create-edit-edition?book=${bookId}`}
                    style={{ fontSize: '12px' }}
                  >
                    ➕ New Edition
                  </Link>
                </div>
              ) : (
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px', color: '#64748b' }}>
                  No editions exist for this book yet.{' '}
                  <Link href={`/publishing-catalog/create-edit-edition?book=${bookId}`} style={{ fontWeight: 700, color: '#2563eb' }}>
                    Create an edition first ➔
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Register Identifier Form */}
          {canCreate && selectedEdition && (
            <section className="panel catalog-form" style={{ borderTop: '3px solid #3b82f6', marginBottom: '22px' }}>
              <h2 className="section-title">
                Register Identifier for Edition {selectedEdition.edition_number} ({selectedEdition.format})
              </h2>
              <div className="catalog-form-grid">
                {/* Identifier Type with PLUS Button */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>
                    Identifier Type <span style={{ color: '#dc2626' }}>*</span>
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      className="input"
                      value={type}
                      onChange={event => setType(event.target.value)}
                      style={{ flex: 1 }}
                    >
                      {allIdentifierTypes.map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => { setShowCustomTypeModal(true); setNewTypeInput(''); }}
                      title="Add custom identifier type"
                      style={{ whiteSpace: 'nowrap', padding: '7px 11px', fontWeight: 700 }}
                    >
                      ➕
                    </button>
                  </div>
                </label>

                {/* Identifier Value */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>
                    Identifier Value <span style={{ color: '#dc2626' }}>*</span>
                  </span>
                  <input
                    className="input"
                    value={value}
                    onChange={event => setValue(event.target.value)}
                    maxLength={80}
                    placeholder={type === 'ISBN' ? 'e.g. 978-0-123456-47-2 or 9780123456472' : 'Identifier code'}
                  />
                </label>

                {/* External Source / Agency */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>Issuing Agency / Source</span>
                  <input
                    className="input"
                    value={source}
                    onChange={event => setSource(event.target.value)}
                    maxLength={120}
                    placeholder="e.g. National Book Centre / Raja Rammohun Roy Agency"
                  />
                </label>

                {/* External Issue Date */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>Official Issue Date</span>
                  <input
                    className="input"
                    type="date"
                    value={issueDate}
                    onChange={event => setIssueDate(event.target.value)}
                  />
                </label>
              </div>

              <p className="muted" style={{ marginTop: '8px', fontSize: '12px' }}>
                ISBN-13 checksum validation and organization-level uniqueness are automatically enforced upon submission.
              </p>

              <button
                className="btn btn-primary"
                disabled={busy || !editionId || !value.trim()}
                onClick={() =>
                  void act(async () => {
                    await api(`/editions/${editionId}/identifiers`, {
                      method: 'POST',
                      body: JSON.stringify({
                        type,
                        value: value.trim(),
                        source: source.trim() || undefined,
                        issueDate: issueDate || null,
                      }),
                    });
                    setValue('');
                    setSource('');
                    setIssueDate('');
                  }, 'Identifier submitted for internal review.')
                }
              >
                Submit Identifier for Validation
              </button>
            </section>
          )}
        </>
      )}

      {/* Identifiers List & Search Controls */}
      <div className="catalog-list-controls">
        <input
          className="input"
          aria-label="Search identifiers"
          value={queryInput}
          onChange={event => setQueryInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              setPage(0);
              setQuery(queryInput.trim());
            }
          }}
          placeholder="Search by identifier value, title, or edition..."
        />
        <button
          className="btn"
          onClick={() => {
            setPage(0);
            setQuery(queryInput.trim());
          }}
        >
          Search
        </button>

        <label className="field" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
          <span>Status:</span>
          <select
            className="input"
            value={status}
            onChange={event => {
              setPage(0);
              setStatus(event.target.value);
            }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending Validation</option>
            <option value="validated">Internally Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        {canExport && (
          <button className="btn" disabled={busy} onClick={() => void exportCsv()}>
            Export CSV
          </button>
        )}
      </div>

      <div className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Book Title</th>
              <th>Edition</th>
              <th>Type</th>
              <th>Identifier Value</th>
              <th>Source</th>
              <th>Issue Date</th>
              <th>Review Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map(item => {
                const isValidated = item.status === 'validated';
                const isPending = item.status === 'pending';
                return (
                  <tr key={item.id} style={{ background: item.id === selected?.id ? '#fef9c3' : undefined }}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{item.book_title}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px' }}>
                        {item.edition_code || `Ed #${item.edition_number}`} · <em>{item.format}</em>
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-blue">{item.identifier_type}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: '13px', fontWeight: 700 }}>{item.identifier_value}</code>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{item.source || '—'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{day(item.issue_date)}</span>
                    </td>
                    <td>
                      <span className={`badge ${isValidated ? 'badge-green' : isPending ? 'badge-amber' : 'badge-red'}`}>
                        {isValidated ? 'Internally Approved' : item.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm" onClick={() => void select(item)}>
                        Review / History
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="empty" colSpan={8}>
                  {loading ? 'Loading identifiers…' : 'No identifiers match this filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="catalog-pagination">
        <span>
          {total} identifiers · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
        </span>
        <div className="button-row">
          <button className="btn" disabled={page === 0} onClick={() => setPage(value => value - 1)}>
            Previous
          </button>
          <button className="btn" disabled={(page + 1) * 25 >= total} onClick={() => setPage(value => value + 1)}>
            Next
          </button>
        </div>
      </div>

      {/* Decision / Review Panel */}
      {selected && (
        <section className="panel catalog-form" style={{ marginTop: '20px', borderTop: '3px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              {selected.identifier_type} {selected.identifier_value} ({selected.book_title})
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link
                className="btn btn-sm"
                href={`/publishing-catalog/edition-detail?book=${selected.book_id}&edition=${selected.edition_id}`}
              >
                Open Linked Edition ➔
              </Link>
              <button type="button" className="btn btn-sm" onClick={() => setSelected(null)}>
                Close Panel
              </button>
            </div>
          </div>

          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '14px 0 8px', color: '#334155' }}>
            Internal Review History
          </h3>
          {history.length ? (
            <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
              {history.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 14px',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', marginBottom: '2px' }}>
                    <span>{day(item.occurred_at)}</span>
                    <span style={{ fontWeight: 600 }}>
                      {item.previous_status} ➔ {item.new_status}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: '#0f172a' }}>{item.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ marginBottom: '16px' }}>No decision records yet.</p>
          )}

          {canApprove && selected.status === 'pending' && (
            <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #86efac' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#166534' }}>
                Record Internal Assignment Decision
              </h4>

              <div className="catalog-form-grid">
                <label className="field">
                  <span>
                    Decision <span style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>
                  </span>
                  <select className="input" value={decision} onChange={event => setDecision(event.target.value)}>
                    <option value="validated">Approve Internal Assignment</option>
                    <option value="rejected">Reject</option>
                  </select>
                </label>

                <label className="field">
                  <span>
                    Review Note / Evidence <span style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: comment.trim().length < 5 ? '#dc2626' : '#16a34a',
                        marginLeft: '6px',
                      }}
                    >
                      (minimum 5 characters · {comment.trim().length}/5)
                    </span>
                  </span>
                  <input
                    className="input"
                    value={comment}
                    onChange={event => setComment(event.target.value)}
                    maxLength={500}
                    placeholder="e.g. Approved internal assignment / Verified against ISBN registry"
                  />
                </label>
              </div>

              <div className="button-row" style={{ marginTop: '14px' }}>
                <button
                  className="btn btn-primary"
                  disabled={busy || comment.trim().length < 5}
                  title={
                    comment.trim().length < 5
                      ? `Please enter at least 5 characters in review note (currently ${comment.trim().length}/5)`
                      : ''
                  }
                  onClick={() =>
                    void act(async () => {
                      await api(`/identifiers/${selected.id}/validations`, {
                        method: 'POST',
                        body: JSON.stringify({ status: decision, comment: comment.trim() }),
                      });
                      setSelected(null);
                    }, 'Decision recorded successfully.')
                  }
                >
                  Record Decision
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modal: Add Custom Identifier Type */}
      {showCustomTypeModal && (
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
          onClick={e => { if (e.target === e.currentTarget) setShowCustomTypeModal(false); }}
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
                ➕ Add Custom Identifier Type
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomTypeModal(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <label className="field" style={{ marginBottom: '16px' }}>
              <span>Identifier Type Name</span>
              <input
                className="input"
                autoFocus
                placeholder="e.g. ASIN, URN, LCCN"
                value={newTypeInput}
                onChange={e => setNewTypeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              />
            </label>
            <div className="button-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn" onClick={() => setShowCustomTypeModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!newTypeInput.trim()}
                onClick={() => {
                  const val = newTypeInput.trim();
                  if (val && !customTypes.includes(val)) {
                    setCustomTypes(prev => [...prev, val]);
                  }
                  setType(val);
                  setShowCustomTypeModal(false);
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
