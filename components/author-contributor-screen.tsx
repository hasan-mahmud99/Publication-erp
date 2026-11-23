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
  publisher_name?: string | null;
  primary_author?: string | null;
  category_name?: string | null;
  publication_status?: string | null;
  edition_count?: number;
};

type Author = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

type Contributor = {
  author_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  contributor_role: string;
  display_order: number;
};

const CONTRIBUTOR_ROLES = [
  { value: 'author', label: 'Author (Primary / Main Author)', color: '#6366f1', bg: '#eef2ff' },
  { value: 'co_author', label: 'Co-Author', color: '#2563eb', bg: '#eff6ff' },
  { value: 'editor', label: 'Editor', color: '#059669', bg: '#ecfdf5' },
  { value: 'translator', label: 'Translator', color: '#d97706', bg: '#fffbeb' },
  { value: 'illustrator', label: 'Illustrator', color: '#0d9488', bg: '#f0fdfa' },
  { value: 'cover_designer', label: 'Cover Designer', color: '#db2777', bg: '#fdf2f8' },
  { value: 'typesetter', label: 'Typesetter / Formatter', color: '#475569', bg: '#f8fafc' },
  { value: 'proofreader', label: 'Proofreader', color: '#0284c7', bg: '#f0f9ff' },
  { value: 'foreword_by', label: 'Foreword / Preface By', color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'photographer', label: 'Photographer', color: '#ca8a04', bg: '#fefce8' },
  { value: 'narrator', label: 'Narrator (Audiobook)', color: '#9333ea', bg: '#faf5ff' },
  { value: 'compiler', label: 'Compiler / Anthologist', color: '#ea580c', bg: '#fff7ed' },
  { value: 'other', label: 'Other Contributor', color: '#64748b', bg: '#f1f5f9' },
];

export function AuthorContributorScreen({ screen }: { screen: Screen }) {
  const router = useRouter();

  // Books state
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [isChangingBook, setIsChangingBook] = useState(false);

  // Contributors state
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);

  // Form state
  const [authorId, setAuthorId] = useState('');
  const [roleValue, setRoleValue] = useState('author');
  const [order, setOrder] = useState('0');
  const [editingAssignment, setEditingAssignment] = useState<Contributor | null>(null);

  // Quick Add Author Modal State
  const [showAddAuthorModal, setShowAddAuthorModal] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [newAuthorEmail, setNewAuthorEmail] = useState('');
  const [newAuthorPhone, setNewAuthorPhone] = useState('');
  const [isAddingAuthor, setIsAddingAuthor] = useState(false);
  const [authorAddError, setAuthorAddError] = useState('');

  // Status & permissions
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');
  const canDelete = role === 'Owner' || permissions.includes('workspace.delete');

  const selectedBook = books.find(b => b.id === bookId);

  // Filtered books for quick search picker
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

  async function loadBooksList(query = '') {
    try {
      const res = await api<{ data: Book[] }>(`/books?limit=100${query ? `&q=${encodeURIComponent(query)}` : ''}`);
      setBooks(current => {
        const incoming = res.data || [];
        if (!bookId) return incoming;
        const exists = incoming.some(item => item.id === bookId);
        if (exists) return incoming;
        const currentSelected = current.find(item => item.id === bookId);
        return currentSelected ? [currentSelected, ...incoming] : incoming;
      });
    } catch (err: any) {
      setError(err?.message || 'Could not load books');
    }
  }

  async function loadAuthorsList() {
    try {
      const res = await api<{ data: Author[] }>('/authors');
      setAuthors(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load authors');
    }
  }

  async function loadContributors(targetBookId: string) {
    if (!targetBookId) {
      setContributors([]);
      return;
    }
    try {
      const res = await api<{ data: Contributor[] }>(`/books/${targetBookId}/contributors`);
      const items = res.data || [];
      // Sort by display_order ascending, then name
      items.sort((a, b) => (a.display_order - b.display_order) || a.name.localeCompare(b.name));
      setContributors(items);
      // Auto-set next default order for new contributor
      if (!editingAssignment) {
        const maxOrder = items.reduce((max, c) => Math.max(max, c.display_order), -1);
        setOrder(String(maxOrder + 1));
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load contributors');
    }
  }

  // Initial mount: load current user, books, authors, and handle URL ?book=
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const wantedBookId = searchParams.get('book') || '';

    Promise.all([
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      api<{ data: Author[] }>('/authors'),
      api<{ data: Book[] }>('/books?limit=100'),
    ])
      .then(async ([meRes, authorsRes, booksRes]) => {
        setRole(meRes.data.role);
        setPermissions(meRes.data.permissions);
        setAuthors(authorsRes.data || []);

        const availableBooks = booksRes.data || [];
        if (wantedBookId && !availableBooks.some(b => b.id === wantedBookId)) {
          try {
            const single = await api<{ data: Book }>(`/books/${wantedBookId}`);
            if (single?.data) availableBooks.unshift(single.data);
          } catch {
            // Book not found by id
          }
        }
        setBooks(availableBooks);

        const initialBookId = wantedBookId || availableBooks[0]?.id || '';
        setBookId(initialBookId);
        if (initialBookId) {
          void loadContributors(initialBookId);
        }
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not initialize screen'))
      .finally(() => setLoading(false));
  }, [screen.id]);

  function selectBook(b: Book) {
    setBookId(b.id);
    setIsChangingBook(false);
    setEditingAssignment(null);
    setAuthorId('');
    setError('');
    setNotice('');
    router.replace(`/publishing-catalog/author-contributor-assignment?book=${b.id}`);
    void loadContributors(b.id);
  }

  async function runTask(task: () => Promise<void>, successMessage: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      setNotice(successMessage);
    } catch (reason: any) {
      setError(reason instanceof Error ? reason.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  }

  // Assign a contributor
  async function assignContributor() {
    if (!bookId || !authorId) return;
    await runTask(async () => {
      await api(`/books/${bookId}/contributors`, {
        method: 'POST',
        body: JSON.stringify({
          authorId,
          role: roleValue,
          displayOrder: Number(order) || 0,
        }),
      });
      await loadContributors(bookId);
      setAuthorId('');
      setRoleValue('author');
      // Update book list to reflect primary author if order 0
      await loadBooksList();
    }, 'Contributor assigned successfully.');
  }

  // Update existing contributor assignment
  async function updateContributor() {
    if (!editingAssignment || !bookId) return;
    await runTask(async () => {
      await api(`/books/${bookId}/contributors/${editingAssignment.author_id}/${editingAssignment.contributor_role}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: roleValue,
          displayOrder: Number(order) || 0,
        }),
      });
      await loadContributors(bookId);
      setEditingAssignment(null);
      setAuthorId('');
      setRoleValue('author');
      await loadBooksList();
    }, 'Contributor assignment updated.');
  }

  // Remove a contributor
  async function removeContributor(item: Contributor) {
    if (!window.confirm(`Remove ${item.name} (${item.contributor_role}) from "${selectedBook?.title || 'this book'}"?\n\nThe author record will remain in the master directory.`)) {
      return;
    }
    await runTask(async () => {
      await api(`/books/${bookId}/contributors/${item.author_id}/${item.contributor_role}`, {
        method: 'DELETE',
      });
      if (editingAssignment?.author_id === item.author_id && editingAssignment?.contributor_role === item.contributor_role) {
        setEditingAssignment(null);
        setAuthorId('');
      }
      await loadContributors(bookId);
      await loadBooksList();
    }, `Removed ${item.name} from book contributors.`);
  }

  // Move contributor Up or Down in order
  async function moveContributor(index: number, direction: 'up' | 'down') {
    if (!bookId || busy) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= contributors.length) return;

    const currentItem = contributors[index];
    const targetItem = contributors[targetIndex];

    setBusy(true);
    setError('');
    try {
      // Swap their display_order values (or re-number sequentially)
      const currentOrder = currentItem.display_order;
      const targetOrder = targetItem.display_order;
      const newCurrentOrder = currentOrder === targetOrder ? (direction === 'up' ? targetOrder : targetOrder + 1) : targetOrder;
      const newTargetOrder = currentOrder === targetOrder ? (direction === 'up' ? targetOrder + 1 : targetOrder) : currentOrder;

      await Promise.all([
        api(`/books/${bookId}/contributors/${currentItem.author_id}/${currentItem.contributor_role}`, {
          method: 'PATCH',
          body: JSON.stringify({ displayOrder: newCurrentOrder }),
        }),
        api(`/books/${bookId}/contributors/${targetItem.author_id}/${targetItem.contributor_role}`, {
          method: 'PATCH',
          body: JSON.stringify({ displayOrder: newTargetOrder }),
        }),
      ]);

      await loadContributors(bookId);
      setNotice(`Reordered contributors: ${currentItem.name} is now order #${newCurrentOrder}.`);
    } catch (err: any) {
      setError(err?.message || 'Could not reorder contributors');
    } finally {
      setBusy(false);
    }
  }

  // Set as Primary Author (order 0)
  async function makePrimaryAuthor(item: Contributor) {
    if (!bookId || busy) return;
    if (item.display_order === 0) return;

    setBusy(true);
    setError('');
    try {
      // Set this contributor to 0, bump others
      const updates = contributors.map(c => {
        if (c.author_id === item.author_id && c.contributor_role === item.contributor_role) {
          return api(`/books/${bookId}/contributors/${c.author_id}/${c.contributor_role}`, {
            method: 'PATCH',
            body: JSON.stringify({ displayOrder: 0 }),
          });
        }
        return api(`/books/${bookId}/contributors/${c.author_id}/${c.contributor_role}`, {
          method: 'PATCH',
          body: JSON.stringify({ displayOrder: c.display_order + 1 }),
        });
      });

      await Promise.all(updates);
      await loadContributors(bookId);
      await loadBooksList();
      setNotice(`⭐ ${item.name} is now designated as the Primary Author.`);
    } catch (err: any) {
      setError(err?.message || 'Could not set as primary author');
    } finally {
      setBusy(false);
    }
  }

  // Quick Add Author to Master Directory
  async function handleQuickAddAuthor() {
    if (!newAuthorName.trim()) {
      setAuthorAddError('Author name is required.');
      return;
    }
    setIsAddingAuthor(true);
    setAuthorAddError('');
    try {
      const res = await api<{ data: Author }>('/authors', {
        method: 'POST',
        body: JSON.stringify({
          name: newAuthorName.trim(),
          email: newAuthorEmail.trim() || undefined,
          phone: newAuthorPhone.trim() || undefined,
        }),
      });
      const created = res.data;
      // Refresh authors list
      await loadAuthorsList();
      // Select the newly added author immediately
      setAuthorId(created.id);
      setShowAddAuthorModal(false);
      setNewAuthorName('');
      setNewAuthorEmail('');
      setNewAuthorPhone('');
      setNotice(`Author "${created.name}" created and selected.`);
    } catch (err: any) {
      setAuthorAddError(err?.message || 'Failed to create author');
    } finally {
      setIsAddingAuthor(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">Author & Contributor Assignment</h1>
          <p className="muted">
            Credit authors, co-authors, editors, translators, illustrators, and other creative contributors to catalog titles.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void loadBooksList();
              void loadAuthorsList();
              if (bookId) void loadContributors(bookId);
            }}
          >
            Refresh
          </button>
          <Link className="btn" href="/publishing-catalog/book-catalog-list">
            Open Book Catalog ➔
          </Link>
        </div>
      </div>

      {error && <div className="alert-error" role="alert" style={{ marginBottom: '14px' }}>{error}</div>}
      {notice && <div className="alert-success" role="status" style={{ marginBottom: '14px' }}>{notice}</div>}

      {loading ? (
        <div className="panel empty">Loading catalog contributors…</div>
      ) : (
        <>
          {/* Executive Book Selector Header */}
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
                      Primary Author: <strong style={{ color: '#0f172a' }}>{selectedBook.primary_author || 'None assigned yet'}</strong> ·
                      Publisher: <strong>{selectedBook.publisher_name || 'None'}</strong> ·
                      Category: <strong>{selectedBook.category_name || 'General'}</strong> ·
                      Editions: <strong>{selectedBook.edition_count ?? 0}</strong>
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
            /* Live Search Book Picker */
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
                    🔍 Select Book to Manage Contributors
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#15803d' }}>
                    Choose a title to view, assign, or reorder credited authors, editors, translators, and illustrators.
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
                  placeholder="Type to filter books by title, code, primary author, or category..."
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
                      onClick={() => selectBook(b)}
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
                          Primary Author: <strong>{b.primary_author || '—'}</strong> ·
                          Publisher: <strong>{b.publisher_name || '—'}</strong> ·
                          Category: <strong>{b.category_name || '—'}</strong>
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

          {bookId && (
            <div style={{ display: 'grid', gap: '22px' }}>
              {/* Assigned Contributors Table */}
              <section className="panel catalog-form">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h2 className="section-title" style={{ margin: 0 }}>
                      Assigned Contributors ({contributors.length})
                    </h2>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                      The contributor at <strong>Order #0</strong> is designated as the <strong>Primary Author</strong> across catalog listings and sales documents.
                    </p>
                  </div>
                  {contributors.length > 1 && (
                    <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>
                      💡 Tip: Use ⬆️ / ⬇️ to reorder priority
                    </span>
                  )}
                </div>

                {contributors.length > 0 ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '90px' }}>Order</th>
                          <th>Contributor</th>
                          <th>Role</th>
                          <th>Contact</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contributors.map((item, index) => {
                          const isPrimary = item.display_order === 0;
                          const roleMeta = CONTRIBUTOR_ROLES.find(r => r.value === item.contributor_role) || {
                            label: item.contributor_role,
                            color: '#475569',
                            bg: '#f1f5f9',
                          };
                          const isEditingThis =
                            editingAssignment?.author_id === item.author_id &&
                            editingAssignment?.contributor_role === item.contributor_role;

                          return (
                            <tr
                              key={`${item.author_id}-${item.contributor_role}`}
                              style={{
                                background: isEditingThis ? '#fef9c3' : isPrimary ? '#f8fafc' : undefined,
                              }}
                            >
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span
                                    className="badge"
                                    style={{
                                      fontWeight: isPrimary ? 800 : 600,
                                      background: isPrimary ? '#fef08a' : '#e2e8f0',
                                      color: isPrimary ? '#854d0e' : '#334155',
                                    }}
                                  >
                                    #{item.display_order}
                                  </span>
                                  {canUpdate && contributors.length > 1 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                      <button
                                        type="button"
                                        disabled={index === 0 || busy}
                                        onClick={() => void moveContributor(index, 'up')}
                                        title="Move up in order"
                                        style={{
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: index === 0 ? 'default' : 'pointer',
                                          fontSize: '10px',
                                          padding: '0 2px',
                                          opacity: index === 0 ? 0.3 : 1,
                                        }}
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        disabled={index === contributors.length - 1 || busy}
                                        onClick={() => void moveContributor(index, 'down')}
                                        title="Move down in order"
                                        style={{
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: index === contributors.length - 1 ? 'default' : 'pointer',
                                          fontSize: '10px',
                                          padding: '0 2px',
                                          opacity: index === contributors.length - 1 ? 0.3 : 1,
                                        }}
                                      >
                                        ▼
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      background: roleMeta.bg,
                                      color: roleMeta.color,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      fontSize: '12px',
                                      border: `1px solid ${roleMeta.color}33`,
                                    }}
                                  >
                                    {item.name.charAt(0).toUpperCase()}
                                  </span>
                                  <div>
                                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.name}</strong>
                                    {isPrimary && (
                                      <span
                                        className="badge badge-amber"
                                        style={{ marginLeft: '6px', fontSize: '11px', padding: '1px 6px' }}
                                      >
                                        ⭐ Primary Author
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background: roleMeta.bg,
                                    color: roleMeta.color,
                                    border: `1px solid ${roleMeta.color}40`,
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    padding: '3px 8px',
                                  }}
                                >
                                  {roleMeta.label}
                                </span>
                              </td>

                              <td>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  {item.email || item.phone || '—'}
                                </span>
                              </td>

                              <td style={{ textAlign: 'right' }}>
                                <div className="button-row" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                                  {!isPrimary && canUpdate && (
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      disabled={busy}
                                      onClick={() => void makePrimaryAuthor(item)}
                                      title="Designate as Primary Author (Order 0)"
                                      style={{ fontSize: '12px' }}
                                    >
                                      ⭐ Make Primary
                                    </button>
                                  )}
                                  {canUpdate && (
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={() => {
                                        setEditingAssignment(item);
                                        setAuthorId(item.author_id);
                                        setRoleValue(item.contributor_role);
                                        setOrder(String(item.display_order));
                                      }}
                                      style={{ fontSize: '12px' }}
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      disabled={busy}
                                      onClick={() => void removeContributor(item)}
                                      style={{ fontSize: '12px', color: '#dc2626' }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '24px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      textAlign: 'center',
                      border: '1px dashed #cbd5e1',
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>
                      No contributors are currently assigned to "{selectedBook?.title || 'this book'}".
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                      Use the assignment form below to credit the author or collaborators.
                    </p>
                  </div>
                )}
              </section>

              {/* Assignment Form (Assign or Edit) */}
              {(canCreate || (editingAssignment && canUpdate)) && (
                <section className="panel catalog-form" style={{ borderTop: '3px solid #6366f1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <h2 className="section-title" style={{ margin: 0 }}>
                      {editingAssignment
                        ? `✏️ Edit Contributor Assignment: ${editingAssignment.name}`
                        : `➕ Assign Contributor to "${selectedBook?.title || 'Selected Book'}"`}
                    </h2>
                    {editingAssignment && (
                      <span className="badge badge-amber">
                        Editing Active Assignment
                      </span>
                    )}
                  </div>

                  <div className="catalog-form-grid">
                    {/* Contributor Dropdown with Prominent PLUS BUTTON */}
                    <label className="field">
                      <span style={{ fontWeight: 600 }}>
                        Contributor / Author <span style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          className="input"
                          disabled={Boolean(editingAssignment)}
                          value={authorId}
                          onChange={e => setAuthorId(e.target.value)}
                          style={{ flex: 1 }}
                        >
                          <option value="">-- Select an Author / Contributor --</option>
                          {authors.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} {a.email ? `(${a.email})` : ''}
                            </option>
                          ))}
                        </select>
                        {!editingAssignment && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setShowAddAuthorModal(true)}
                            title="Quick-create a new author in the master directory"
                            style={{
                              whiteSpace: 'nowrap',
                              padding: '8px 12px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            ➕ New Contributor
                          </button>
                        )}
                      </div>
                    </label>

                    {/* Role Dropdown */}
                    <label className="field">
                      <span style={{ fontWeight: 600 }}>
                        Contributor Role <span style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>
                      </span>
                      <select
                        className="input"
                        value={roleValue}
                        onChange={e => setRoleValue(e.target.value)}
                      >
                        {CONTRIBUTOR_ROLES.map(r => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Display Order */}
                    <label className="field">
                      <span style={{ fontWeight: 600 }}>
                        Display Order (Priority)
                      </span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="9999"
                        value={order}
                        onChange={e => setOrder(e.target.value)}
                        placeholder="0 for Primary Author"
                      />
                      <small style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Order 0 is the Primary Author displayed on public catalog listings.
                      </small>
                    </label>
                  </div>

                  <div className="button-row" style={{ marginTop: '16px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || !authorId}
                      onClick={() => void (editingAssignment ? updateContributor() : assignContributor())}
                    >
                      {busy ? 'Saving…' : editingAssignment ? 'Save Assignment Changes' : 'Assign Contributor'}
                    </button>
                    {editingAssignment && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setEditingAssignment(null);
                          setAuthorId('');
                          setRoleValue('author');
                          const maxOrder = contributors.reduce((max, c) => Math.max(max, c.display_order), -1);
                          setOrder(String(maxOrder + 1));
                        }}
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* Informational Guidance: How Author/Contributor Assignment Works */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '18px 22px',
                }}
              >
                <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: '#334155' }}>
                  ℹ️ How Author & Contributor Assignment Works
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', fontSize: '13px', color: '#475569' }}>
                  <div>
                    <strong style={{ color: '#0f172a' }}>1. Primary Author (Order #0):</strong>
                    <p style={{ margin: '3px 0 0' }}>
                      The contributor with Display Order <code>0</code> is automatically used as the title's primary author in sales orders, catalog exports, and online channels.
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>2. Collaborative Credits:</strong>
                    <p style={{ margin: '3px 0 0' }}>
                      Assign co-authors, translators, editors, illustrators, cover designers, and typesetters to give full professional attribution.
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>3. Rights & Royalties Integration:</strong>
                    <p style={{ margin: '3px 0 0' }}>
                      Contributors assigned here link seamlessly with the Authors, Contracts & Rights module for royalty calculations and statement distribution.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick Add Author Modal */}
      {showAddAuthorModal && (
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
            if (e.target === e.currentTarget) setShowAddAuthorModal(false);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                ➕ Create New Contributor
              </h2>
              <button
                type="button"
                onClick={() => setShowAddAuthorModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
              Add a new author or contributor to the enterprise master directory. They will immediately become selectable for this book.
            </p>

            {authorAddError && (
              <div className="alert-error" style={{ marginBottom: '12px', fontSize: '13px' }}>
                {authorAddError}
              </div>
            )}

            <div style={{ display: 'grid', gap: '12px' }}>
              <label className="field">
                <span style={{ fontWeight: 600 }}>
                  Full Name / Pen Name <span style={{ color: '#dc2626' }}>*</span>
                </span>
                <input
                  className="input"
                  autoFocus
                  placeholder="e.g. Humayun Ahmed, Kazi Nazrul Islam"
                  value={newAuthorName}
                  onChange={e => setNewAuthorName(e.target.value)}
                />
              </label>

              <label className="field">
                <span style={{ fontWeight: 600 }}>Email Address (optional)</span>
                <input
                  className="input"
                  type="email"
                  placeholder="author@example.com"
                  value={newAuthorEmail}
                  onChange={e => setNewAuthorEmail(e.target.value)}
                />
              </label>

              <label className="field">
                <span style={{ fontWeight: 600 }}>Phone Number (optional)</span>
                <input
                  className="input"
                  placeholder="+880 1XXXXXXXXX"
                  value={newAuthorPhone}
                  onChange={e => setNewAuthorPhone(e.target.value)}
                />
              </label>
            </div>

            <div className="button-row" style={{ marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowAddAuthorModal(false)}
                disabled={isAddingAuthor}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isAddingAuthor || !newAuthorName.trim()}
                onClick={() => void handleQuickAddAuthor()}
              >
                {isAddingAuthor ? 'Creating…' : 'Save & Select Contributor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
