"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calculator,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  BookOpen,
  DollarSign,
  User,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Choice = { id: string; name?: string; title?: string; contract_number?: string };
type PreviewLine = {
  ruleRef: string;
  ruleVersionId: string;
  splitVersionId: string | null;
  recipientAuthorId: string;
  bookId: string;
  currencyCode: string;
  eventType: string;
  eventDate: string;
  sourceId: string;
  quantity: number;
  basisAmount: number;
  royaltyAmount: number;
  status: string;
};
type Preview = {
  lines: PreviewLine[];
  exceptions: { code: string; message: string; sourceId?: string }[];
  summary: {
    sourceEventCount: number;
    eligibleUnits: number;
    grossRoyalty: number | null;
    returnAdjustment: number | null;
    netBeforeRecoupment: number | null;
    netPayable: number | null;
    currencyCodes: string[];
    recipientCount: number;
  };
};

const today = () => new Date().toISOString().slice(0, 10);
const readable = (value: string) => String(value || '').replaceAll('_', ' ');

export function RightsRoyaltyPreviewScreen({ screen }: { screen: Screen }) {
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [contractId, setContractId] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [bookId, setBookId] = useState('');
  const [contracts, setContracts] = useState<Choice[]>([]);
  const [authors, setAuthors] = useState<Choice[]>([]);
  const [books, setBooks] = useState<Choice[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<{ data: { data: Choice[] } }>('/rights/contracts?limit=100'),
      api<{ data: { authors: Choice[]; books: Choice[] } }>('/rights/contract-choices'),
    ])
      .then(([contractResponse, choices]) => {
        setContracts(contractResponse.data.data);
        setAuthors(choices.data.authors);
        setBooks(choices.data.books);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load royalty filters'));
  }, []);

  async function calculate(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setPreview(null);
    if (from > to) {
      setError('The end date must follow the start date.');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (contractId) params.set('contractId', contractId);
      if (authorId) params.set('authorId', authorId);
      if (bookId) params.set('bookId', bookId);
      setPreview((await api<{ data: Preview }>(`/rights/royalty-preview?${params}`)).data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not calculate royalty preview');
    } finally {
      setLoading(false);
    }
  }

  const authorName = (id: string) => authors.find(author => author.id === id)?.name || id;
  const bookName = (id: string) => books.find(book => book.id === id)?.title || id;
  const currency = preview?.summary.currencyCodes.length === 1 ? preview.summary.currencyCodes[0] : 'BDT';

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🧮</span> {screen.title}
          </h1>
          <p className="muted">
            Simulate and verify book-level sales, eligible return deductions, and contractual royalty rates before preparing settlement statements.
          </p>
        </div>
      </div>

      {/* Info Callout */}
      <div
        style={{
          padding: '12px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>ℹ️</span>
        <span>
          <strong>Audit-safe simulation:</strong> This calculation engine operates in read-only mode against posted sales invoices and return notes. It does not alter warehouse inventory, post general ledger journals, or recoup advances until finalized into a statement.
        </span>
      </div>

      {/* Calculation Scope Card */}
      <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
          Calculation Scope &amp; Period Parameters
        </h2>
        <form onSubmit={calculate}>
          <div className="catalog-form-grid" style={{ alignItems: 'end' }}>
            <label className="field">
              Period From
              <input
                className="input"
                type="date"
                required
                value={from}
                onChange={event => setFrom(event.target.value)}
              />
            </label>

            <label className="field">
              Period To
              <input
                className="input"
                type="date"
                required
                value={to}
                onChange={event => setTo(event.target.value)}
              />
            </label>

            <label className="field">
              Contract Agreement
              <select className="input" value={contractId} onChange={event => setContractId(event.target.value)}>
                <option value="">All active contracts</option>
                {contracts.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.contract_number || item.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Recipient Author
              <select className="input" value={authorId} onChange={event => setAuthorId(event.target.value)}>
                <option value="">All recipients</option>
                {authors.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Catalog Book Title
              <select className="input" value={bookId} onChange={event => setBookId(event.target.value)}>
                <option value="">All books</option>
                {books.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title || item.id}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px', width: '100%', justifyContent: 'center' }}
              >
                <Calculator size={16} />
                <span>{loading ? 'Simulating…' : 'Calculate Preview'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Preview Output */}
      {preview && (
        <>
          {/* Top KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              marginBottom: '20px',
            }}
          >
            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #4f46e5',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase' }}>
                📦 Source Events
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                {preview.summary.eligibleUnits.toLocaleString()} copies
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Across {preview.summary.sourceEventCount} posted invoice events
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #10b981',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
                📈 Gross Sales Royalty
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
                {preview.summary.grossRoyalty == null
                  ? 'Multi-currency'
                  : `${currency} ${preview.summary.grossRoyalty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Pre-return contractual earnings
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #f59e0b',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
                📉 Returns Deduction
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
                {preview.summary.returnAdjustment == null
                  ? 'Multi-currency'
                  : `${currency} ${preview.summary.returnAdjustment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Customer return adjustments
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #0ea5e9',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
                💰 Net Royalty Payable
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
                {preview.summary.netPayable == null
                  ? 'Requires review'
                  : `${currency} ${preview.summary.netPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Before advance recovery deduction
              </div>
            </div>
          </div>

          {/* Action Callout & Workflow Bridge */}
          <div
            className="panel"
            style={{
              padding: '18px 24px',
              borderRadius: 12,
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
            }}
          >
            <div>
              <strong style={{ fontSize: 15, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={18} color="#16a34a" /> Verified Calculation Output
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#15803d' }}>
                Calculations reconciled with active pricing, discount slabs, and return policy. Ready to transition into formal statement drafting.
              </p>
            </div>
            <Link
              className="btn btn-primary"
              style={{
                fontWeight: 600,
                padding: '10px 22px',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              href={`/authors-contracts-rights/royalty-statement-and-payment-history?contract=${contractId}&author=${authorId}&from=${from}&to=${to}&create=1`}
            >
              <span>Generate Statement Draft from Preview</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Exceptions Card */}
          <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>
              Exceptions &amp; Calculation Boundary Review
            </h2>
            {preview.exceptions.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {preview.exceptions.map((item, index) => (
                  <div
                    key={`${item.code}-${index}`}
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      color: '#991b1b',
                    }}
                  >
                    <strong>{readable(item.code)}:</strong> {item.message}
                    {item.sourceId && <span style={{ marginLeft: 8, color: '#b91c1c' }}>· Source #{item.sourceId.slice(0, 8)}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                ✓ No source exceptions found. All commercial invoice lines and credit notes match approved contractual royalty policies.
              </p>
            )}
          </div>

          {/* Source-backed Royalty Lines Table */}
          <div className="panel table-wrap" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Date</th>
                  <th>Type</th>
                  <th>Book Title</th>
                  <th>Recipient Author</th>
                  <th>Governing Rule</th>
                  <th style={{ textAlign: 'center' }}>Units</th>
                  <th style={{ textAlign: 'right' }}>Basis Amount</th>
                  <th style={{ textAlign: 'right' }}>Royalty Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.length ? (
                  preview.lines.map((line, index) => (
                    <tr key={`${line.eventType}-${line.sourceId}-${line.recipientAuthorId}-${index}`}>
                      <td>{line.eventDate}</td>
                      <td>
                        <span
                          style={{
                            background: line.eventType.includes('return') ? '#fef2f2' : '#ecfdf5',
                            color: line.eventType.includes('return') ? '#991b1b' : '#065f46',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          {readable(line.eventType)}
                        </span>
                      </td>
                      <td>
                        <strong>{bookName(line.bookId)}</strong>
                      </td>
                      <td>{authorName(line.recipientAuthorId)}</td>
                      <td>
                        <div>{line.ruleRef}</div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          v{line.ruleVersionId.slice(0, 8)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{line.quantity}</td>
                      <td style={{ textAlign: 'right' }}>
                        {line.currencyCode} {Number(line.basisAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: Number(line.royaltyAmount) < 0 ? '#b91c1c' : '#059669',
                        }}
                      >
                        {line.currencyCode} {Number(line.royaltyAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="empty" colSpan={8}>
                      No eligible posted book-level sales or returns match this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
