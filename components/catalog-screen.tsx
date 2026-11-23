"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Book = { id: string; title: string; publication_status: string; version_no: number; created_at: string; categoryOptionId?: string };
type Edition = { id: string; book_id: string; book_title?: string; edition_number: string; format: string; page_count: number | null; publication_date: string | null; status: string; publisher_id: string | null; publisher_name?: string; version_no: number };
type Identifier = { id: string; edition_id: string; identifier_type: string; identifier_value: string; source: string | null; status: string; issue_date: string | null; book_title?: string };
type Price = { id: string; edition_id: string; price_type: string; currency_code: string; amount: string; effective_from: string; effective_to: string | null; status: string };
type Person = { id: string; name: string };
type Contributor = { author_id: string; name: string; contributor_role: string; display_order: number };
type TimelineEntry = { id: string; action: string; entity_type: string; occurred_at: string };
type ImportJob = { id: string; fileName: string; status: string; validRows: number; invalidRows: number; createdAt: string };
const date = (value: string | null | undefined) => value ? String(value).slice(0, 10) : '—';
const inputDate = (value: string | null | undefined) => value ? String(value).slice(0, 10) : '';
const link = (title: string, bookId?: string, editionId?: string) => {
  const screenPath: Record<string, string> = {
    'Book Detail & Timeline': '/publishing-catalog/book-detail-and-timeline',
    'Create/Edit Edition': '/publishing-catalog/create-edit-edition',
    'Edition Detail': '/publishing-catalog/edition-detail',
    'ISBN & Identifier Register': '/publishing-catalog/isbn-and-identifier-register',
    'Price List Management': '/publishing-catalog/price-list-management',
  };
  const params = new URLSearchParams();
  if (bookId) params.set('book', bookId);
  if (editionId) params.set('edition', editionId);
  return `${screenPath[title]}${params.size ? `?${params}` : ''}`;
};

export function CatalogScreen({ screen }: { screen: Screen }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookRows, setBookRows] = useState<Book[]>([]);
  const [bookPage, setBookPage] = useState(0);
  const [bookTotal, setBookTotal] = useState(0);
  const [bookQueryInput, setBookQueryInput] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [bookId, setBookId] = useState('');
  const [editions, setEditions] = useState<Edition[]>([]);
  const [allEditions, setAllEditions] = useState<Edition[]>([]);
  const [editionPage, setEditionPage] = useState(0);
  const [editionTotal, setEditionTotal] = useState(0);
  const [editionQueryInput, setEditionQueryInput] = useState('');
  const [editionQuery, setEditionQuery] = useState('');
  const [editionId, setEditionId] = useState('');
  const [identifiers, setIdentifiers] = useState<Identifier[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [pending, setPending] = useState<Identifier[]>([]);
  const [authors, setAuthors] = useState<Person[]>([]);
  const [publishers, setPublishers] = useState<Person[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [imprints, setImprints] = useState<Person[]>([]);
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [bookStatus, setBookStatus] = useState('draft');
  const [editingEdition, setEditingEdition] = useState(false);
  const [editionNumber, setEditionNumber] = useState('1');
  const [format, setFormat] = useState('paperback');
  const [pageCount, setPageCount] = useState('');
  const [publicationDate, setPublicationDate] = useState('');
  const [editionPublisher, setEditionPublisher] = useState('');
  const [editionStatus, setEditionStatus] = useState('draft');
  const [identifierType, setIdentifierType] = useState('ISBN');
  const [identifierValue, setIdentifierValue] = useState('');
  const [identifierSource, setIdentifierSource] = useState('');
  const [identifierIssueDate, setIdentifierIssueDate] = useState('');
  const [priceType, setPriceType] = useState('list');
  const [priceCurrency, setPriceCurrency] = useState('BDT');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [contributorRole, setContributorRole] = useState('author');
  const [publisherName, setPublisherName] = useState('');
  const [publisherId, setPublisherId] = useState('');
  const [imprintName, setImprintName] = useState('');

  const selectedBook = books.find(book => book.id === bookId);
  const selectedEdition = editions.find(edition => edition.id === editionId);
  const canWrite = role === 'Owner' || permissions.includes('workspace.create') || permissions.includes('workspace.update');

  async function loadBase(preferredBook?: string) {
    const [bookResult, authorResult, publisherResult, me] = await Promise.all([
      api<{ data: Book[] }>('/books?limit=100'),
      api<{ data: Person[] }>('/authors'),
      api<{ data: Person[] }>('/publishers'),
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
    ]);
    const wanted = preferredBook || bookId;
    let availableBooks = bookResult.data;
    if (wanted && !availableBooks.some(book => book.id === wanted)) {
      try {
        const extra = await api<{ data: Book }>(`/books/${wanted}`);
        availableBooks = [...availableBooks, extra.data];
      } catch { /* A stale selection should not prevent the catalog from opening. */ }
    }
    setBooks(availableBooks);
    setAuthors(authorResult.data);
    setPublishers(publisherResult.data);
    setRole(me.data.role); setPermissions(me.data.permissions);
    setBookId(current => {
      const candidate = preferredBook || current;
      return availableBooks.some(book => book.id === candidate) ? candidate : availableBooks[0]?.id || '';
    });
  }
  async function loadBookPage(page: number, q: string) {
    const params = new URLSearchParams({ limit: '10', offset: String(page * 10) });
    if (q) params.set('q', q);
    const result = await api<{ data: Book[]; meta: { total: number } }>(`/books?${params}`);
    setBookRows(result.data); setBookTotal(result.meta.total);
  }
  async function loadEditionPage(page: number, q: string) {
    const params = new URLSearchParams({ limit: '10', offset: String(page * 10) });
    if (q) params.set('q', q);
    const result = await api<{ data: Edition[]; meta: { total: number } }>(`/editions?${params}`);
    setAllEditions(result.data); setEditionTotal(result.meta.total);
  }
  async function loadBookRelations(id: string) {
    const [editionResult, contributorResult, timelineResult] = await Promise.all([
      api<{ data: Edition[] }>(`/books/${id}/editions`),
      api<{ data: Contributor[] }>(`/books/${id}/contributors`),
      api<{ data: TimelineEntry[] }>(`/books/${id}/timeline`),
    ]);
    setEditions(editionResult.data);
    setContributors(contributorResult.data);
    setTimeline(timelineResult.data);
    setEditionId(current => editionResult.data.some(item => item.id === current) ? current : editionResult.data[0]?.id || '');
  }
  async function loadEditionRelations(id: string) {
    const [identifierResult, priceResult] = await Promise.all([
      api<{ data: Identifier[] }>(`/editions/${id}/identifiers`),
      api<{ data: Price[] }>(`/editions/${id}/prices`),
    ]);
    setIdentifiers(identifierResult.data);
    setPrices(priceResult.data);
  }
  async function loadPending() {
    const result = await api<{ data: Identifier[] }>('/identifiers?status=pending');
    setPending(result.data);
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantedBook = params.get('book') || sessionStorage.getItem('catalog_book_id') || undefined;
    const wantedEdition = params.get('edition') || sessionStorage.getItem('catalog_edition_id') || '';
    if (wantedEdition) setEditionId(wantedEdition);
    setLoading(true);
    void loadBase(wantedBook).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load catalog')).finally(() => setLoading(false));
  }, []);
  useEffect(() => { void loadBookPage(bookPage, bookQuery).catch(() => setError('Could not load books')); }, [bookPage, bookQuery]);
  useEffect(() => { void loadEditionPage(editionPage, editionQuery).catch(() => setError('Could not load editions')); }, [editionPage, editionQuery]);
  useEffect(() => {
    if (!bookId) { setEditions([]); setEditionId(''); return; }
    sessionStorage.setItem('catalog_book_id', bookId);
    void loadBookRelations(bookId).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load book details'));
  }, [bookId]);
  useEffect(() => {
    if (!editionId) { setIdentifiers([]); setPrices([]); return; }
    sessionStorage.setItem('catalog_edition_id', editionId);
    void loadEditionRelations(editionId).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load edition details'));
  }, [editionId]);
  useEffect(() => {
    if (!selectedBook || screen.title === 'Create Book') return;
    setBookTitle(selectedBook.title);
    setBookStatus(selectedBook.publication_status);
  }, [selectedBook?.id, screen.title]);
  useEffect(() => {
    if (!editingEdition || !selectedEdition) return;
    setEditionNumber(selectedEdition.edition_number);
    setFormat(selectedEdition.format);
    setPageCount(selectedEdition.page_count == null ? '' : String(selectedEdition.page_count));
    setPublicationDate(inputDate(selectedEdition.publication_date));
    setEditionPublisher(selectedEdition.publisher_id || '');
    setEditionStatus(selectedEdition.status);
  }, [editingEdition, selectedEdition?.id]);
  useEffect(() => { if (screen.title === 'Identifier Validation Queue') void loadPending().catch(() => setError('Could not load validation queue')); }, [screen.title]);
  useEffect(() => {
    if (!publisherId) { setImprints([]); return; }
    void api<{ data: Person[] }>(`/publishers/${publisherId}/imprints`).then(result => setImprints(result.data)).catch(() => setError('Could not load imprints'));
  }, [publisherId]);

  async function act(task: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function createBook() {
    await act(async () => {
      const result = await api<{ data: Book }>('/books', { method: 'POST', body: JSON.stringify({ title: bookTitle.trim(), status: bookStatus }) });
      await loadBase(result.data.id); setBookId(result.data.id);
      await loadBookPage(bookPage, bookQuery);
    }, 'Book created');
  }
  async function updateBook() {
    if (!bookId) return;
    await act(async () => {
      await api(`/books/${bookId}`, { method: 'PATCH', body: JSON.stringify({ title: bookTitle.trim(), status: bookStatus, version: Number(selectedBook?.version_no) }) });
      await loadBase(bookId);
      await loadBookPage(bookPage, bookQuery);
    }, 'Book updated');
  }
  async function saveEdition() {
    if (!bookId) return;
    await act(async () => {
      const body = { editionNumber: editionNumber.trim(), format, pageCount: pageCount ? Number(pageCount) : null, publicationDate: publicationDate || null, publisherId: editionPublisher || null, status: editionStatus };
      const result = editingEdition && selectedEdition
        ? await api<{ data: { id: string } }>(`/editions/${selectedEdition.id}`, { method: 'PATCH', body: JSON.stringify({ ...body, version: Number(selectedEdition.version_no) }) })
        : await api<{ data: { id: string } }>(`/books/${bookId}/editions`, { method: 'POST', body: JSON.stringify(body) });
      await loadBookRelations(bookId);
      await loadBase(bookId);
      await loadEditionPage(editionPage, editionQuery);
      setEditionId(result.data.id);
      setEditingEdition(false);
    }, editingEdition ? 'Edition updated' : 'Edition created');
  }
  async function addIdentifier() {
    if (!editionId) return;
    await act(async () => {
      await api(`/editions/${editionId}/identifiers`, { method: 'POST', body: JSON.stringify({ type: identifierType, value: identifierValue.trim(), source: identifierSource.trim() || undefined, issueDate: identifierIssueDate || null }) });
      setIdentifierValue(''); setIdentifierSource(''); setIdentifierIssueDate('');
      await loadEditionRelations(editionId);
    }, 'Identifier added to validation queue');
  }
  async function reviewIdentifier(id: string, status: 'validated' | 'rejected') {
    const comment = window.prompt(`${status === 'rejected' ? 'Rejection reason' : 'Validation reference or note'}`);
    if (comment === null || (status === 'rejected' && !comment.trim())) return;
    await act(async () => {
      await api(`/identifiers/${id}/validations`, { method: 'POST', body: JSON.stringify({ status, comment }) });
      await loadPending();
      if (editionId) await loadEditionRelations(editionId);
    }, `Identifier ${status}`);
  }
  async function addPrice() {
    if (!editionId) return;
    await act(async () => {
      await api(`/editions/${editionId}/prices`, { method: 'POST', body: JSON.stringify({ priceType, currencyCode: priceCurrency, amount: Number(priceAmount), effectiveFrom: priceFrom, effectiveTo: priceTo || null }) });
      setPriceAmount(''); setPriceFrom(''); setPriceTo('');
      await loadEditionRelations(editionId);
    }, 'Price saved');
  }
  async function archivePrice(id: string) {
    if (!window.confirm('Archive this price? Its history will remain available.')) return;
    await act(async () => { await api(`/prices/${id}/archive`, { method: 'POST' }); await loadEditionRelations(editionId); }, 'Price archived');
  }
  async function addAuthor() {
    await act(async () => {
      const result = await api<{ data: Person }>('/authors', { method: 'POST', body: JSON.stringify({ name: authorName.trim() }) });
      setAuthorName(''); setAuthors(current => [...current, result.data].sort((a, b) => a.name.localeCompare(b.name))); setAuthorId(result.data.id);
    }, 'Contributor created');
  }
  async function assignAuthor() {
    if (!bookId || !authorId) return;
    await act(async () => {
      await api(`/books/${bookId}/contributors`, { method: 'POST', body: JSON.stringify({ authorId, role: contributorRole }) });
      await loadBookRelations(bookId);
    }, 'Contributor assigned');
  }
  async function addPublisher() {
    await act(async () => {
      const result = await api<{ data: Person }>('/publishers', { method: 'POST', body: JSON.stringify({ name: publisherName.trim() }) });
      setPublisherName(''); setPublishers(current => [...current, result.data].sort((a, b) => a.name.localeCompare(b.name))); setPublisherId(result.data.id);
    }, 'Publisher created');
  }
  async function addImprint() {
    if (!publisherId) return;
    await act(async () => {
      const result = await api<{ data: Person }>(`/publishers/${publisherId}/imprints`, { method: 'POST', body: JSON.stringify({ name: imprintName.trim() }) });
      setImprintName(''); setImprints(current => [...current, result.data]);
    }, 'Imprint created');
  }

  const bookSelector = <label className="field">Book<select className="input" value={bookId} onChange={event => { setBookId(event.target.value); setEditingEdition(false); }}><option value="">Select a book</option>{books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>;
  const editionSelector = <label className="field">Edition<select className="input" value={editionId} onChange={event => setEditionId(event.target.value)}><option value="">Select an edition</option>{editions.map(edition => <option key={edition.id} value={edition.id}>{edition.edition_number} · {edition.format}</option>)}</select></label>;
  const bookTable = (items: Book[]) => <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Title</th><th>Status</th><th>Created</th><th>Details</th></tr></thead><tbody>{items.length ? items.map(book => <tr key={book.id}><td>{book.title}</td><td>{book.publication_status}</td><td>{date(book.created_at)}</td><td><Link className="btn" href={link('Book Detail & Timeline', book.id)}>Open</Link></td></tr>) : <tr><td colSpan={4} className="empty">No books found.</td></tr>}</tbody></table></div>;
  const editionTable = (items: Edition[]) => <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Book</th><th>Edition</th><th>Format</th><th>Publication date</th><th>Status</th><th>Details</th></tr></thead><tbody>{items.length ? items.map(edition => <tr key={edition.id}><td>{edition.book_title || selectedBook?.title || '—'}</td><td>{edition.edition_number}</td><td>{edition.format}</td><td>{date(edition.publication_date)}</td><td>{edition.status}</td><td><Link className="btn" href={link('Edition Detail', edition.book_id, edition.id)}>Open</Link></td></tr>) : <tr><td colSpan={6} className="empty">No editions found.</td></tr>}</tbody></table></div>;

  let content: React.ReactNode;
  switch (screen.title) {
    case 'Book Catalog List':
      content = <><div className="catalog-list-controls"><input className="input" aria-label="Search books" placeholder="Search book titles" value={bookQueryInput} onChange={event => setBookQueryInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setBookPage(0); setBookQuery(bookQueryInput.trim()); } }} /><button className="btn" onClick={() => { setBookPage(0); setBookQuery(bookQueryInput.trim()); }}>Search</button>{canWrite && <Link className="btn btn-primary" href="/publishing-catalog/create-book">Create book</Link>}</div>{bookTable(bookRows)}<div className="catalog-pagination"><span>{bookTotal} books · Page {bookPage + 1} of {Math.max(1, Math.ceil(bookTotal / 10))}</span><div className="button-row"><button className="btn" disabled={bookPage === 0} onClick={() => setBookPage(page => page - 1)}>Previous</button><button className="btn" disabled={(bookPage + 1) * 10 >= bookTotal} onClick={() => setBookPage(page => page + 1)}>Next</button></div></div></>;
      break;
    case 'Create Book':
    case 'Edit Book':
      content = <section className="panel catalog-form">{screen.title === 'Edit Book' && bookSelector}<label className="field">Book title<input className="input" required maxLength={500} value={bookTitle} onChange={event => setBookTitle(event.target.value)} /></label><label className="field">Publication status<select className="input" value={bookStatus} onChange={event => setBookStatus(event.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="discontinued">Discontinued</option></select></label>{canWrite && <button className="btn btn-primary" disabled={busy || !bookTitle.trim() || (screen.title === 'Edit Book' && !bookId)} onClick={() => void (screen.title === 'Create Book' ? createBook() : updateBook())}>{screen.title === 'Create Book' ? 'Create book' : 'Save changes'}</button>}{bookId && <Link className="btn" href={link('Book Detail & Timeline', bookId)}>View book</Link>}</section>;
      break;
    case 'Book Detail & Timeline':
      content = <>{bookSelector}{selectedBook ? <><section className="panel catalog-form"><h2 className="section-title">{selectedBook.title}</h2><p>Status: {selectedBook.publication_status}</p><p>Created: {date(selectedBook.created_at)}</p><div className="button-row"><Link className="btn" href={link('Create/Edit Edition', bookId)}>Add edition</Link><Link className="btn" href={link('ISBN & Identifier Register', bookId, editionId)}>Identifiers</Link></div></section>{editionTable(editions)}<section className="panel catalog-form"><h2 className="section-title">Book timeline</h2>{timeline.length ? timeline.map(item => <p key={item.id}>{date(item.occurred_at)} · {item.action} · {item.entity_type}</p>) : <p className="muted">No timeline events yet.</p>}</section></> : <p className="empty">Select a book.</p>}</>;
      break;
    case 'Edition List':
      content = <><div className="catalog-list-controls"><input className="input" aria-label="Search editions" placeholder="Search title or edition number" value={editionQueryInput} onChange={event => setEditionQueryInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setEditionPage(0); setEditionQuery(editionQueryInput.trim()); } }} /><button className="btn" onClick={() => { setEditionPage(0); setEditionQuery(editionQueryInput.trim()); }}>Search</button>{canWrite && <Link className="btn btn-primary" href={link('Create/Edit Edition', bookId)}>Create edition</Link>}</div>{editionTable(allEditions)}<div className="catalog-pagination"><span>{editionTotal} editions · Page {editionPage + 1} of {Math.max(1, Math.ceil(editionTotal / 10))}</span><div className="button-row"><button className="btn" disabled={editionPage === 0} onClick={() => setEditionPage(page => page - 1)}>Previous</button><button className="btn" disabled={(editionPage + 1) * 10 >= editionTotal} onClick={() => setEditionPage(page => page + 1)}>Next</button></div></div></>;
      break;
    case 'Create/Edit Edition':
      content = <section className="panel catalog-form"><div className="catalog-selectors">{bookSelector}{editionSelector}</div>{selectedEdition && <button className="btn" onClick={() => setEditingEdition(current => !current)}>{editingEdition ? 'Create a new edition' : 'Edit selected edition'}</button>}<div className="catalog-form-grid"><label className="field">Edition number<input className="input" required value={editionNumber} onChange={event => setEditionNumber(event.target.value)} /></label><label className="field">Format<select className="input" value={format} onChange={event => setFormat(event.target.value)}><option value="paperback">Paperback</option><option value="hardcover">Hardcover</option><option value="ebook">E-book</option><option value="audiobook">Audiobook</option><option value="other">Other</option></select></label><label className="field">Page count<input className="input" type="number" min="1" value={pageCount} onChange={event => setPageCount(event.target.value)} /></label><label className="field">Publication date<input className="input" type="date" value={publicationDate} onChange={event => setPublicationDate(event.target.value)} /></label><label className="field">Publisher<select className="input" value={editionPublisher} onChange={event => setEditionPublisher(event.target.value)}><option value="">Select publisher</option>{publishers.map(publisher => <option key={publisher.id} value={publisher.id}>{publisher.name}</option>)}</select></label><label className="field">Status<select className="input" value={editionStatus} onChange={event => setEditionStatus(event.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label></div>{canWrite && <button className="btn btn-primary" disabled={busy || !bookId || !editionNumber.trim()} onClick={() => void saveEdition()}>{editingEdition ? 'Save edition' : 'Create edition'}</button>}</section>;
      break;
    case 'Edition Detail':
      content = <>{bookSelector}{editionSelector}{selectedEdition ? <><section className="panel catalog-form"><h2 className="section-title">{selectedBook?.title} · Edition {selectedEdition.edition_number}</h2><p>Format: {selectedEdition.format} · Pages: {selectedEdition.page_count ?? '—'} · Publication: {date(selectedEdition.publication_date)}</p><p>Publisher: {selectedEdition.publisher_name || publishers.find(item => item.id === selectedEdition.publisher_id)?.name || '—'} · Status: {selectedEdition.status}</p><div className="button-row"><Link className="btn" href={link('ISBN & Identifier Register', bookId, editionId)}>Identifiers</Link><Link className="btn" href={link('Price List Management', bookId, editionId)}>Prices</Link></div></section><section className="panel catalog-form"><h2 className="section-title">Identifiers</h2>{identifiers.map(item => <p key={item.id}>{item.identifier_type}: {item.identifier_value} · {item.status}</p>)}</section><section className="panel catalog-form"><h2 className="section-title">Price history</h2>{prices.map(item => <p key={item.id}>{item.price_type}: {item.currency_code} {item.amount} · from {date(item.effective_from)} · {item.status}</p>)}</section></> : <p className="empty">Select an edition.</p>}</>;
      break;
    case 'ISBN & Identifier Register':
      content = <>{bookSelector}{editionSelector}{canWrite && <section className="panel catalog-form"><h2 className="section-title">Add identifier</h2><div className="catalog-form-grid"><label className="field">Type<select className="input" value={identifierType} onChange={event => setIdentifierType(event.target.value)}><option>ISBN</option><option>SKU</option><option>DOI</option><option>OTHER</option></select></label><label className="field">Value<input className="input" value={identifierValue} onChange={event => setIdentifierValue(event.target.value)} /></label><label className="field">Source or application reference<input className="input" value={identifierSource} onChange={event => setIdentifierSource(event.target.value)} /></label><label className="field">Issue date<input className="input" type="date" value={identifierIssueDate} onChange={event => setIdentifierIssueDate(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || !editionId || !identifierValue.trim()} onClick={() => void addIdentifier()}>Add identifier</button></section>}<div className="panel table-wrap"><table className="data-table"><thead><tr><th>Type</th><th>Value</th><th>Status</th><th>Issue date</th></tr></thead><tbody>{identifiers.length ? identifiers.map(item => <tr key={item.id}><td>{item.identifier_type}</td><td>{item.identifier_value}</td><td>{item.status}</td><td>{date(item.issue_date)}</td></tr>) : <tr><td colSpan={4} className="empty">No identifiers for this edition.</td></tr>}</tbody></table></div></>;
      break;
    case 'Identifier Validation Queue':
      content = <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Book</th><th>Identifier</th><th>Type</th><th>Decision</th></tr></thead><tbody>{pending.length ? pending.map(item => <tr key={item.id}><td>{item.book_title}</td><td>{item.identifier_value}</td><td>{item.identifier_type}</td><td>{canWrite && <div className="button-row"><button className="btn btn-primary" disabled={busy} onClick={() => void reviewIdentifier(item.id, 'validated')}>Validate</button><button className="btn" disabled={busy} onClick={() => void reviewIdentifier(item.id, 'rejected')}>Reject</button></div>}</td></tr>) : <tr><td colSpan={4} className="empty">No identifiers await validation.</td></tr>}</tbody></table></div>;
      break;
    case 'Author/Contributor Assignment':
      content = <>{bookSelector}<section className="panel catalog-form"><h2 className="section-title">Contributors for {selectedBook?.title || 'selected book'}</h2>{contributors.length ? contributors.map(item => <p key={`${item.author_id}-${item.contributor_role}`}>{item.name} · {item.contributor_role}</p>) : <p className="muted">No contributors assigned.</p>}{canWrite && <><div className="catalog-form-grid"><label className="field">Contributor<select className="input" value={authorId} onChange={event => setAuthorId(event.target.value)}><option value="">Select contributor</option>{authors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Role<select className="input" value={contributorRole} onChange={event => setContributorRole(event.target.value)}><option value="author">Author</option><option value="editor">Editor</option><option value="translator">Translator</option><option value="illustrator">Illustrator</option><option value="other">Other</option></select></label></div><button className="btn btn-primary" disabled={busy || !bookId || !authorId} onClick={() => void assignAuthor()}>Assign contributor</button><label className="field">New contributor name<input className="input" value={authorName} onChange={event => setAuthorName(event.target.value)} /></label><button className="btn" disabled={busy || !authorName.trim()} onClick={() => void addAuthor()}>Create contributor</button></>}</section></>;
      break;
    case 'Publisher & Imprint Management':
      content = <section className="panel catalog-form"><h2 className="section-title">Publishers and imprints</h2><label className="field">Publisher<select className="input" value={publisherId} onChange={event => setPublisherId(event.target.value)}><option value="">Select publisher</option>{publishers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{publisherId && <div>{imprints.length ? imprints.map(item => <p key={item.id}>{item.name}</p>) : <p className="muted">No imprints yet.</p>}</div>}{canWrite && <><label className="field">New publisher<input className="input" value={publisherName} onChange={event => setPublisherName(event.target.value)} /></label><button className="btn" disabled={busy || !publisherName.trim()} onClick={() => void addPublisher()}>Create publisher</button><label className="field">New imprint for selected publisher<input className="input" value={imprintName} onChange={event => setImprintName(event.target.value)} /></label><button className="btn btn-primary" disabled={busy || !publisherId || !imprintName.trim()} onClick={() => void addImprint()}>Create imprint</button></>}</section>;
      break;
    case 'Price List Management':
      content = <>{bookSelector}{editionSelector}{canWrite && <section className="panel catalog-form"><h2 className="section-title">Add effective-dated price</h2><div className="catalog-form-grid"><label className="field">Price type<select className="input" value={priceType} onChange={event => setPriceType(event.target.value)}><option value="list">List</option><option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="digital">Digital</option></select></label><label className="field">Currency<input className="input" maxLength={3} value={priceCurrency} onChange={event => setPriceCurrency(event.target.value.toUpperCase())} /></label><label className="field">Amount<input className="input" type="number" min="0.01" step="0.01" value={priceAmount} onChange={event => setPriceAmount(event.target.value)} /></label><label className="field">Effective from<input className="input" type="date" value={priceFrom} onChange={event => setPriceFrom(event.target.value)} /></label><label className="field">Effective to (optional)<input className="input" type="date" value={priceTo} onChange={event => setPriceTo(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || !editionId || !priceAmount || !priceFrom} onClick={() => void addPrice()}>Save price</button></section>}<div className="panel table-wrap"><table className="data-table"><thead><tr><th>Type</th><th>Amount</th><th>From</th><th>To</th><th>Status</th><th>Action</th></tr></thead><tbody>{prices.length ? prices.map(item => <tr key={item.id}><td>{item.price_type}</td><td>{item.currency_code} {item.amount}</td><td>{date(item.effective_from)}</td><td>{date(item.effective_to)}</td><td>{item.status}</td><td>{canWrite && item.status === 'active' && <button className="btn" disabled={busy} onClick={() => void archivePrice(item.id)}>Archive</button>}</td></tr>) : <tr><td colSpan={6} className="empty">No prices for this edition.</td></tr>}</tbody></table></div></>;
      break;
    default:
      content = <p className="empty">This catalog screen is being prepared.</p>;
  }

  return <><div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{screen.description}</p></div><button className="btn" onClick={() => void loadBase(bookId).catch(reason => setError(reason instanceof Error ? reason.message : 'Refresh failed'))}>Refresh</button></div>{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}{loading ? <div className="panel empty">Loading catalog…</div> : content}</>;
}
