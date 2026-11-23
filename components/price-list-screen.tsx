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

type Edition = {
  id: string;
  book_id: string;
  edition_number: string;
  format: string;
  edition_code: string | null;
  status: string;
  publication_date: string | null;
};

type Price = {
  id: string;
  edition_id: string;
  price_type: string;
  currency_code: string;
  amount: string;
  effective_from: string;
  effective_to: string | null;
  status: string;
  created_at: string;
};

const DEFAULT_PRICE_TYPES = [
  { value: 'retail', label: 'Retail Cover Price (MSRP)' },
  { value: 'list', label: 'Standard List Price' },
  { value: 'wholesale', label: 'Wholesale / Trade Price' },
  { value: 'distributor', label: 'Distributor Rate' },
  { value: 'promotional', label: 'Promotional / Fair Price' },
  { value: 'school', label: 'School / Academic Discount' },
  { value: 'library', label: 'Library Binding Rate' },
  { value: 'digital', label: 'E-Book / Digital Download' },
  { value: 'special', label: 'Special Institutional Rate' },
];

const DEFAULT_CURRENCIES = ['BDT', 'USD', 'GBP', 'EUR', 'INR', 'CAD'];

const day = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : '—');
const todayStr = () => new Date().toISOString().slice(0, 10);

export function PriceListScreen({ screen }: { screen: Screen }) {
  const router = useRouter();

  // Books & Editions state
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [isChangingBook, setIsChangingBook] = useState(false);

  const [editions, setEditions] = useState<Edition[]>([]);
  const [editionId, setEditionId] = useState('');
  const [prices, setPrices] = useState<Price[]>([]);

  // Form state
  const [priceType, setPriceType] = useState('retail');
  const [customPriceTypes, setCustomPriceTypes] = useState<string[]>([]);
  const [currencyCode, setCurrencyCode] = useState('BDT');
  const [customCurrencies, setCustomCurrencies] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayStr());
  const [effectiveTo, setEffectiveTo] = useState('');

  // Modals for + buttons
  const [showCustomTypeModal, setShowCustomTypeModal] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState('');
  const [showCustomCurrencyModal, setShowCustomCurrencyModal] = useState(false);
  const [newCurrencyInput, setNewCurrencyInput] = useState('');

  // Permissions & UI states
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');

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

  async function loadPrices(targetEditionId: string) {
    if (!targetEditionId) {
      setPrices([]);
      return;
    }
    try {
      const res = await api<{ data: Price[] }>(`/editions/${targetEditionId}/prices`);
      setPrices(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load price lists');
    }
  }

  // Initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantedBook = params.get('book') || '';
    const wantedEdition = params.get('edition') || '';

    Promise.all([
      api<{ data: Book[] }>('/books?limit=100'),
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
    ])
      .then(async ([booksRes, meRes]) => {
        setRole(meRes.data.role);
        setPermissions(meRes.data.permissions);

        const available = booksRes.data || [];
        if (wantedBook && !available.some(b => b.id === wantedBook)) {
          try {
            const single = await api<{ data: Book }>(`/books/${wantedBook}`);
            if (single?.data) available.unshift(single.data);
          } catch {}
        }
        setBooks(available);

        const initialBookId = wantedBook || available[0]?.id || '';
        setBookId(initialBookId);

        if (initialBookId) {
          const edRes = await api<{ data: Edition[] }>(`/books/${initialBookId}/editions`);
          const eds = edRes.data || [];
          setEditions(eds);
          const initialEdId = wantedEdition && eds.some(e => e.id === wantedEdition) ? wantedEdition : eds[0]?.id || '';
          setEditionId(initialEdId);
          if (initialEdId) {
            void loadPrices(initialEdId);
          }
        }
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not initialize price list screen'))
      .finally(() => setLoading(false));
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
      router.replace(`/publishing-catalog/price-list-management?book=${b.id}${firstEdId ? `&edition=${firstEdId}` : ''}`);
      if (firstEdId) void loadPrices(firstEdId);
      else setPrices([]);
    } catch (err: any) {
      setError(err?.message || 'Could not load editions for this book');
    }
  }

  function handleSelectEdition(eId: string) {
    setEditionId(eId);
    setError('');
    setNotice('');
    router.replace(`/publishing-catalog/price-list-management?book=${bookId}&edition=${eId}`);
    void loadPrices(eId);
  }

  async function handleAddPrice() {
    if (!editionId || !amount || !effectiveFrom) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/editions/${editionId}/prices`, {
        method: 'POST',
        body: JSON.stringify({
          priceType,
          currencyCode,
          amount: parseFloat(amount),
          effectiveFrom,
          effectiveTo: effectiveTo || null,
        }),
      });
      await loadPrices(editionId);
      setAmount('');
      setEffectiveTo('');
      setNotice(`Price (${currencyCode} ${amount} - ${priceType}) added successfully.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to save price');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchivePrice(priceId: string) {
    if (!window.confirm('Are you sure you want to archive this price? Active quotations will retain snapshot values.')) {
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/prices/${priceId}/archive`, { method: 'POST' });
      await loadPrices(editionId);
      setNotice('Price archived successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to archive price');
    } finally {
      setBusy(false);
    }
  }

  // Active prices for summary
  const activePrices = prices.filter(p => p.status === 'active');
  const retailPrice = activePrices.find(p => p.price_type === 'retail');
  const wholesalePrice = activePrices.find(p => p.price_type === 'wholesale');
  const listPrice = activePrices.find(p => p.price_type === 'list');
  const digitalPrice = activePrices.find(p => p.price_type === 'digital');

  const allPriceTypes = [
    ...DEFAULT_PRICE_TYPES,
    ...customPriceTypes.map(t => ({ value: t, label: `${t.toUpperCase()} (Custom)` })),
  ];
  const allCurrencies = Array.from(new Set([...DEFAULT_CURRENCIES, ...customCurrencies]));

  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Manage multi-tier, effective-dated prices (retail, wholesale, digital) across catalog editions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (editionId) void loadPrices(editionId);
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
        <div className="panel empty">Loading pricing and catalog data…</div>
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
                      Primary Author: <strong style={{ color: '#0f172a' }}>{selectedBook.primary_author || '—'}</strong> ·
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
                    🔍 Select Book to Manage Pricing
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#15803d' }}>
                    Choose a title to view or update effective-dated list and retail prices across its editions.
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

          {/* Edition Pill Selector Bar */}
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
                  Editions for this Book ({editions.length}):
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Prices in the catalog are attached to specific physical or digital editions.
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

          {/* Pricing Overview Cards for Selected Edition */}
          {selectedEdition && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#166534', letterSpacing: '0.04em' }}>
                  Retail Cover Price (MSRP)
                </span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#14532d', marginTop: '4px' }}>
                  {retailPrice ? `${retailPrice.currency_code} ${parseFloat(retailPrice.amount).toFixed(2)}` : 'Not set'}
                </div>
                <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                  {retailPrice ? `Effective from ${day(retailPrice.effective_from)}` : 'Required for point-of-sale'}
                </div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#1e40af', letterSpacing: '0.04em' }}>
                  Standard List Price
                </span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e3a8a', marginTop: '4px' }}>
                  {listPrice ? `${listPrice.currency_code} ${parseFloat(listPrice.amount).toFixed(2)}` : 'Not set'}
                </div>
                <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
                  {listPrice ? `Base quotation price` : 'Used for contract discounts'}
                </div>
              </div>

              <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#6b21a8', letterSpacing: '0.04em' }}>
                  Wholesale Rate
                </span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#581c87', marginTop: '4px' }}>
                  {wholesalePrice ? `${wholesalePrice.currency_code} ${parseFloat(wholesalePrice.amount).toFixed(2)}` : 'Not set'}
                </div>
                <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '2px' }}>
                  {wholesalePrice ? `Bookseller / Dealer rate` : 'Optional wholesale tier'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
                  Digital / E-Book
                </span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                  {digitalPrice ? `${digitalPrice.currency_code} ${parseFloat(digitalPrice.amount).toFixed(2)}` : 'Not set'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {digitalPrice ? `Online distribution price` : 'For digital storefronts'}
                </div>
              </div>
            </div>
          )}

          {/* Add Price Form */}
          {selectedEdition && canCreate && (
            <section className="panel catalog-form" style={{ borderTop: '3px solid #10b981', marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h2 className="section-title" style={{ margin: 0 }}>
                    ➕ Add Effective-Dated Price for Edition {selectedEdition.edition_number} ({selectedEdition.format})
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Define catalog prices with effective date ranges. Server validates that overlapping date windows do not conflict.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link className="btn btn-sm" href={`/publishing-catalog/isbn-and-identifier-register?book=${bookId}&edition=${editionId}`}>
                    🏷️ View ISBN ➔
                  </Link>
                  <Link className="btn btn-sm" href={`/publishing-catalog/edition-detail?book=${bookId}&edition=${editionId}`}>
                    👁️ Edition Details ➔
                  </Link>
                </div>
              </div>

              <div className="catalog-form-grid">
                {/* Price Type Dropdown with PLUS Button */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>
                    Price Tier / Type <span style={{ color: '#dc2626' }}>*</span>
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      className="input"
                      value={priceType}
                      onChange={e => setPriceType(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      {allPriceTypes.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => { setShowCustomTypeModal(true); setNewTypeInput(''); }}
                      title="Add custom price tier"
                      style={{ whiteSpace: 'nowrap', padding: '7px 11px', fontWeight: 700 }}
                    >
                      ➕
                    </button>
                  </div>
                </label>

                {/* Currency Dropdown with PLUS Button */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>
                    Currency <span style={{ color: '#dc2626' }}>*</span>
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      className="input"
                      value={currencyCode}
                      onChange={e => setCurrencyCode(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      {allCurrencies.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => { setShowCustomCurrencyModal(true); setNewCurrencyInput(''); }}
                      title="Add custom currency"
                      style={{ whiteSpace: 'nowrap', padding: '7px 11px', fontWeight: 700 }}
                    >
                      ➕
                    </button>
                  </div>
                </label>

                {/* Amount */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>
                    Amount ({currencyCode}) <span style={{ color: '#dc2626' }}>*</span>
                  </span>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 350.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </label>

                {/* Effective From */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>
                    Effective From <span style={{ color: '#dc2626' }}>*</span>
                  </span>
                  <input
                    className="input"
                    type="date"
                    value={effectiveFrom}
                    onChange={e => setEffectiveFrom(e.target.value)}
                  />
                </label>

                {/* Effective To */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>
                    Effective To (optional expiry)
                  </span>
                  <input
                    className="input"
                    type="date"
                    value={effectiveTo}
                    onChange={e => setEffectiveTo(e.target.value)}
                  />
                  <small style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Leave blank for open-ended ongoing pricing.
                  </small>
                </label>
              </div>

              <div className="button-row" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !editionId || !amount || !effectiveFrom}
                  onClick={() => void handleAddPrice()}
                >
                  {busy ? 'Saving…' : 'Record & Activate Price'}
                </button>
              </div>
            </section>
          )}

          {/* Price History Table */}
          {selectedEdition && (
            <section className="panel catalog-form">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h2 className="section-title" style={{ margin: 0 }}>
                    Price History for Edition {selectedEdition.edition_number} ({prices.length})
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Audit log of historical and active pricing schedules for this edition.
                  </p>
                </div>
              </div>

              {prices.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Price Tier</th>
                        <th>Amount</th>
                        <th>Effective Period</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prices.map(item => {
                        const isActive = item.status === 'active';
                        return (
                          <tr key={item.id} style={{ background: isActive ? '#f8fafc' : undefined }}>
                            <td>
                              <strong style={{ fontSize: '13px', textTransform: 'capitalize', color: '#0f172a' }}>
                                {item.price_type}
                              </strong>
                            </td>
                            <td>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                                {item.currency_code} {parseFloat(item.amount).toFixed(2)}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', color: '#475569' }}>
                                {day(item.effective_from)} ➔ {item.effective_to ? day(item.effective_to) : 'Present (Ongoing)'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${isActive ? 'badge-green' : 'badge-slate'}`}>
                                {item.status}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>
                                {day(item.created_at)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {canUpdate && isActive && (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  disabled={busy}
                                  onClick={() => void handleArchivePrice(item.id)}
                                  style={{ fontSize: '12px', color: '#dc2626' }}
                                >
                                  Archive Price
                                </button>
                              )}
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
                    No prices recorded for Edition {selectedEdition.edition_number} yet.
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                    Use the form above to add the initial retail cover price.
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Modal: Add Custom Price Tier */}
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
                ➕ Add Custom Price Tier
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
              <span>Price Tier Key</span>
              <input
                className="input"
                autoFocus
                placeholder="e.g. export, library, corporate"
                value={newTypeInput}
                onChange={e => setNewTypeInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
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
                  if (val && !customPriceTypes.includes(val)) {
                    setCustomPriceTypes(prev => [...prev, val]);
                  }
                  setPriceType(val);
                  setShowCustomTypeModal(false);
                }}
              >
                Add &amp; Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Custom Currency */}
      {showCustomCurrencyModal && (
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
          onClick={e => { if (e.target === e.currentTarget) setShowCustomCurrencyModal(false); }}
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
                ➕ Add Custom Currency
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomCurrencyModal(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <label className="field" style={{ marginBottom: '16px' }}>
              <span>3-Letter Currency Code</span>
              <input
                className="input"
                autoFocus
                maxLength={3}
                placeholder="e.g. AUD, JPY, SGD"
                value={newCurrencyInput}
                onChange={e => setNewCurrencyInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              />
            </label>
            <div className="button-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn" onClick={() => setShowCustomCurrencyModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={newCurrencyInput.trim().length !== 3}
                onClick={() => {
                  const val = newCurrencyInput.trim();
                  if (val && !customCurrencies.includes(val)) {
                    setCustomCurrencies(prev => [...prev, val]);
                  }
                  setCurrencyCode(val);
                  setShowCustomCurrencyModal(false);
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
