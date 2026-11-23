"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, ShoppingCart, AlertCircle, FileText, CheckCircle2, RefreshCw, Download, ArrowLeft } from 'lucide-react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';
import { SalesQuotationEditForm } from './sales-quotation-edit-form';
import { SalesQuotationExpiryPanel } from './sales-quotation-expiry-panel';

type Customer = { id: string; customer_code: string; name: string; customer_type: string };
type Edition = { id: string; edition_code: string | null; edition_number: string; format: string; book_title: string; list_price: string };
type Row = { id: string; quotation_number: string; quotation_date: string; valid_until: string; sales_channel: string; status: string; gross_amount: string; discount_amount: string; total_amount: string; customer_name: string; line_count: number; quantity: number };
type QuotationSummary = { total: number; draft: number; pendingApproval: number; approved: number; accepted: number; rejected: number; converted: number; expired: number; quotedValue: string };
type Line = { editionId: string; quantity: string; discountPercent: string };
type Detail = Row & { version_no: number; created_by: string; customer_id: string; customer_code?: string; payment_terms: string | null; delivery_terms: string | null; notes: string | null; acceptance_evidence: string | null; rejection_reason: string | null; rejection_source: string | null; lines: Array<{ id: string; edition_id: string; edition_code: string | null; edition_number?: string; format?: string; book_title: string; quantity: number; unit_list_price: string; discount_bps: number; gross_amount: string; discount_amount: string; net_amount: string }> };
type Revision = { version: number; changedBy: string; changedAt: string; snapshot: { header: { quotation_number: string; customer_id: string; total_amount: string; payment_terms: string | null; delivery_terms: string | null }; lines: Array<{ edition_id: string; quantity: number; unit_list_price: string; discount_bps: number; net_amount: string }> } };

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ editionId: '', quantity: '1', discountPercent: '0' });
const displayMoney = (input: string) => {
  const num = parseFloat(input) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const human = (val: string) => String(val || '').replaceAll('_', ' ');

export function SalesQuotationScreen({ screen }: { screen: Screen }) {
  const router = useRouter();
  const creating = screen.title === 'Create Quotation';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<QuotationSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [number, setNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [quotationDate, setQuotationDate] = useState(today);
  const [validUntil, setValidUntil] = useState(today);
  const [channel, setChannel] = useState('bookstore');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [evidence, setEvidence] = useState('');
  const canManage = role === 'Owner' || permissions.includes('sales.manage');
  const canApprove = role === 'Owner' || permissions.includes('sales.approve');

  async function loadList() {
    const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    const [list, metrics] = await Promise.all([
      api<{ data: { rows: Row[]; total: number } }>(`/sales/quotations?${params}`),
      api<{ data: QuotationSummary }>('/sales/quotations/summary'),
    ]);
    setRows(list.data.rows);
    setTotal(list.data.total);
    setSummary(metrics.data);
  }

  async function loadOptions(asOf: string) {
    const result = (await api<{ data: { customers: Customer[]; editions: Edition[] } }>(`/sales/quotations/options?asOf=${asOf}`)).data;
    setCustomers(result.customers);
    setEditions(result.editions);
  }

  useEffect(() => {
    void api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me').then(result => {
      setUserId(result.data.userId);
      setRole(result.data.role);
      setPermissions(result.data.permissions);
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load permissions'));
  }, []);

  useEffect(() => {
    if (!creating) {
      const id = new URLSearchParams(window.location.search).get('quote');
      if (id) setSelectedId(id);
    }
  }, [creating]);

  useEffect(() => {
    if (!creating) return;
    const sourceId = new URLSearchParams(window.location.search).get('copy');
    if (!sourceId) return;
    let active = true;
    void api<{ data: Detail }>(`/sales/quotations/${encodeURIComponent(sourceId)}`).then(({ data: source }) => {
      if (!active) return;
      const currentDate = today();
      setNumber('');
      setCustomerId(source.customer_id);
      setQuotationDate(currentDate);
      setValidUntil(String(source.valid_until).slice(0, 10) >= currentDate ? String(source.valid_until).slice(0, 10) : currentDate);
      setChannel(source.sales_channel);
      setPaymentTerms(source.payment_terms || '');
      setDeliveryTerms(source.delivery_terms || '');
      setNotes(source.notes || '');
      setLines(source.lines.map(line => ({ editionId: line.edition_id, quantity: String(line.quantity), discountPercent: String(line.discount_bps / 100) })));
      setNotice(`Copied from ${source.quotation_number}. Enter a new quotation number; current Catalog prices apply when you save.`);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load quotation to copy'); });
    return () => { active = false; };
  }, [creating]);

  useEffect(() => {
    setLoading(true);
    void (creating ? loadOptions(quotationDate) : loadList()).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load quotations')).finally(() => setLoading(false));
  }, [creating, quotationDate, page, search, status]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void api<{ data: Detail }>(`/sales/quotations/${selectedId}`).then(result => setDetail(result.data)).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load quotation'));
  }, [selectedId]);

  useEffect(() => {
    if (!detail) {
      setRevisions([]);
      return;
    }
    void api<{ data: Revision[] }>(`/sales/quotations/${detail.id}/revisions`).then(result => setRevisions(result.data)).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load quotation versions'));
  }, [detail?.id, detail?.version_no]);

  function changeLine(index: number, field: keyof Line, value: string) {
    setLines(current => current.map((line, row) => row === index ? { ...line, [field]: value } : line));
  }

  async function create() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ data: Detail }>('/sales/quotations', {
        method: 'POST',
        body: JSON.stringify({
          quotationNumber: number.trim(),
          customerId,
          quotationDate,
          validUntil,
          salesChannel: channel.trim(),
          paymentTerms: paymentTerms.trim(),
          deliveryTerms: deliveryTerms.trim(),
          notes: notes.trim(),
          lines: lines.map(line => ({
            editionId: line.editionId,
            quantity: Number(line.quantity),
            discountBps: Math.round(Number(line.discountPercent) * 100)
          }))
        })
      });
      router.push(`/sales-distribution/sales-quotation-list?quote=${result.data.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create quotation');
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (status) params.set('status', status);
      const blob = await apiFile(`/sales/quotations/export.csv?${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sales-quotations.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export quotations');
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (!detail) return;
    setBusy(true); setError('');
    try {
      const blob = await apiFile(`/sales/quotations/${detail.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quotation-${detail.quotation_number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download quotation PDF');
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: 'submit' | 'approve' | 'reject' | 'accept' | 'customer-reject') {
    if (!selectedId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/sales/quotations/${selectedId}/${action}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ reason: evidence.trim() || undefined })
      });
      setNotice(`Quotation ${action === 'accept' ? 'activated' : action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : action === 'customer-reject' ? 'rejected by customer' : 'rejected'}`);
      setEvidence('');
      await loadList();
      setDetail((await api<{ data: Detail }>(`/sales/quotations/${selectedId}`)).data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update quotation');
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuote(id: string, quoteNumber: string) {
    if (!window.confirm(`Are you sure you want to delete Quotation ${quoteNumber}? This will permanently remove it.`)) {
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/sales/quotations/${id}`, { method: 'DELETE' });
      setNotice(`Quotation ${quoteNumber} deleted successfully.`);
      if (selectedId === id) {
        setSelectedId('');
        setDetail(null);
      }
      await loadList();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Could not delete quotation');
    } finally {
      setBusy(false);
    }
  }

  const mappedPrices = lines.map(line => editions.find(row => row.id === line.editionId));
  const selectedEditionIds = lines.map(l => l.editionId).filter(Boolean);
  const duplicateIds = selectedEditionIds.filter((id, idx) => selectedEditionIds.indexOf(id) !== idx);
  const hasDuplicates = duplicateIds.length > 0;

  const totalQuantity = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  const grossTotal = lines.reduce((sum, l) => {
    const ed = editions.find(e => e.id === l.editionId);
    return sum + (ed ? (parseFloat(ed.list_price) || 0) * (Number(l.quantity) || 0) : 0);
  }, 0);
  const discountTotal = lines.reduce((sum, l) => {
    const ed = editions.find(e => e.id === l.editionId);
    const price = ed ? (parseFloat(ed.list_price) || 0) : 0;
    const gross = price * (Number(l.quantity) || 0);
    const disc = Math.max(0, Math.min(100, Number(l.discountPercent) || 0)) / 100;
    return sum + (gross * disc);
  }, 0);
  const netTotal = grossTotal - discountTotal;

  const allLinesValid = lines.length > 0 && lines.every((line, index) => mappedPrices[index] && Number.isInteger(Number(line.quantity)) && Number(line.quantity) > 0 && Number(line.discountPercent) >= 0 && Number(line.discountPercent) <= 100);
  const canSave = canManage && number.trim().length >= 2 && customerId && validUntil >= quotationDate && allLinesValid && !hasDuplicates;

  function getQuotationValidationHint(): string | null {
    if (!canManage) return 'You do not have permission to manage quotations';
    if (!customerId) return 'Please select a customer';
    if (number.trim().length < 2) return 'Please enter a quotation number (at least 2 characters)';
    if (validUntil < quotationDate) return 'Valid until date cannot be before quotation date';
    if (!allLinesValid) return 'Please select an edition, valid quantity, and discount (0-100%) for all items';
    if (hasDuplicates) return 'Duplicate book editions in cart. Each edition can only be added once';
    return null;
  }
  const quotationHint = getQuotationValidationHint();

  // Status badge styling helper
  function renderStatusPill(st: string) {
    const s = String(st || '').toLowerCase();
    let bg = '#f1f5f9', color = '#475569', border = '#cbd5e1';
    if (s === 'accepted' || s === 'active' || s === 'approved') {
      bg = '#ecfdf5'; color = '#065f46'; border = '#a7f3d0';
    } else if (s === 'draft') {
      bg = '#f1f5f9'; color = '#334155'; border = '#cbd5e1';
    } else if (s === 'pending_approval') {
      bg = '#fffbeb'; color = '#92400e'; border = '#fde68a';
    } else if (s === 'rejected' || s === 'cancelled') {
      bg = '#fef2f2'; color = '#991b1b'; border = '#fecaca';
    } else if (s === 'converted') {
      bg = '#eff6ff'; color = '#1e40af'; border = '#bfdbfe';
    }

    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '999px',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          background: bg,
          color: color,
          border: `1px solid ${border}`
        }}
      >
        {human(st)}
      </span>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          {detail && !creating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
              <button
                type="button"
                onClick={() => { setSelectedId(''); setDetail(null); }}
                style={{ background: 'none', border: 'none', color: '#2563eb', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
              >
                <ArrowLeft size={14} /> Back to Quotations List
              </button>
              <span style={{ color: '#94a3b8' }}>/</span>
              <span style={{ color: '#64748b' }}>Quotation {detail.quotation_number}</span>
            </div>
          )}
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🧾</span> {creating ? 'Create Sales Quotation Offer' : (detail ? `Quotation ${detail.quotation_number}` : screen.title)}
          </h1>
          <p className="muted">
            {creating
              ? 'Draft commercial offers with agreed threshold quantities and discounts for bookstores and institutions.'
              : 'Directory of commercial quotations, volume discount terms, proforma invoices, and customer acceptance.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {creating ? (
            <Link className="btn" href="/sales-distribution/sales-quotation-list" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>←</span> Quotation List
            </Link>
          ) : (
            canManage && (
              <Link className="btn btn-primary" href="/sales-distribution/create-quotation" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>➕</span> New Quotation
              </Link>
            )
          )}
          <Link className="btn" href="/sales-distribution/sales-order-list" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📦</span> Sales Orders
          </Link>
          {!creating && (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => void loadList()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void exportCsv()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} /> Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {error && <div className="alert-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}
      {notice && <div className="alert-success" role="status" style={{ marginBottom: '16px' }}>{notice}</div>}
      {loading && <div className="panel empty" style={{ padding: '36px', textAlign: 'center' }}>Loading quotations…</div>}

      {/* KPI Cards (Click to Filter) */}
      {!creating && !loading && summary && (
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
            onClick={() => { setStatus(''); setPage(0); }}
            style={{
              padding: '16px 20px',
              cursor: 'pointer',
              borderLeft: status === '' ? '4px solid #4f46e5' : '4px solid transparent',
              background: status === '' ? 'var(--panel-active-bg, #f5f3ff)' : undefined,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
              📦 Total Quotations
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
              {summary.total}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Click to view all records
            </div>
          </div>

          <div
            className="panel"
            onClick={() => { setStatus('accepted'); setPage(0); }}
            style={{
              padding: '16px 20px',
              cursor: 'pointer',
              borderLeft: status === 'accepted' ? '4px solid #10b981' : '4px solid transparent',
              background: status === 'accepted' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
              ✅ Accepted &amp; Active
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
              {summary.accepted}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Active and ready for sales orders
            </div>
          </div>

          <div
            className="panel"
            onClick={() => { setStatus('draft'); setPage(0); }}
            style={{
              padding: '16px 20px',
              cursor: 'pointer',
              borderLeft: status === 'draft' ? '4px solid #f59e0b' : '4px solid transparent',
              background: status === 'draft' ? 'var(--panel-active-bg, #fffbeb)' : undefined,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
              ⏳ Draft Offers
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
              {summary.draft + summary.pendingApproval}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Commercial drafts and proposals
            </div>
          </div>

          <div
            className="panel"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #0ea5e9',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
              💰 Pipeline Quoted Value
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
              {displayMoney(summary.quotedValue)} BDT
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Total commercial pipeline value
            </div>
          </div>
        </div>
      )}

      {/* Create Quotation Form */}
      {creating && !loading && (
        <section className="panel catalog-form" style={{ padding: '24px' }}>
          <div className="section-head" style={{ marginBottom: '18px' }}>
            <div>
              <h2 className="section-title" style={{ fontSize: '18px', fontWeight: 700 }}>New Sales Quotation Offer</h2>
              <p className="muted">
                Prepare commercial price proposals for customers and distributors. Active quotations can be selected when placing orders with automatic volume discount scaling.
              </p>
            </div>
          </div>

          {hasDuplicates && (
            <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span><strong>Duplicate Edition in Offer:</strong> Each book edition can only appear once in a quotation. Please combine the quantities.</span>
            </div>
          )}

          <div className="catalog-form-grid" style={{ marginBottom: '16px' }}>
            <label className="field">
              Quotation Number *
              <input className="input" placeholder="e.g. QT-2026-001" value={number} onChange={event => setNumber(event.target.value)} />
            </label>
            <label className="field">
              Customer *
              <select className="input" value={customerId} onChange={event => setCustomerId(event.target.value)}>
                <option value="">Select customer</option>
                {customers.map(row => <option key={row.id} value={row.id}>{row.customer_code} - {row.name} ({row.customer_type})</option>)}
              </select>
            </label>
          </div>

          <div className="catalog-form-grid" style={{ marginBottom: '16px' }}>
            <label className="field">
              Quotation Date
              <input className="input" type="date" value={quotationDate} onChange={event => setQuotationDate(event.target.value)} />
            </label>
            <label className="field">
              Valid Until Date
              <input className="input" type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} />
            </label>
            <label className="field">
              Sales Channel
              <input className="input" value={channel} onChange={event => setChannel(event.target.value)} />
            </label>
          </div>

          <div className="catalog-form-grid" style={{ marginBottom: '20px' }}>
            <label className="field">
              Payment Terms
              <input className="input" placeholder="e.g. Net 30 days or Advance 50%" value={paymentTerms} onChange={event => setPaymentTerms(event.target.value)} />
            </label>
            <label className="field">
              Delivery Terms
              <input className="input" placeholder="e.g. Warehouse pickup or Courier" value={deliveryTerms} onChange={event => setDeliveryTerms(event.target.value)} />
            </label>
            <label className="field">
              Notes
              <input className="input" placeholder="Optional offer notes" value={notes} onChange={event => setNotes(event.target.value)} />
            </label>
          </div>

          <div style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="section-title" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <ShoppingCart size={16} /> Offered Editions Cart ({lines.length})
            </h3>
            <button
              type="button"
              className="btn"
              disabled={lines.length >= 200}
              onClick={() => setLines(current => [...current, emptyLine()])}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} /> Add Edition to Offer
            </button>
          </div>

          {/* Cart Summary KPI */}
          <div className="stat-grid" style={{ marginBottom: '16px' }}>
            <div className="panel stat" style={{ borderLeft: '4px solid #4f46e5' }}>
              <div className="stat-label">Total Titles &amp; Copies</div>
              <div className="stat-value">{lines.filter(l => l.editionId).length} titles · {totalQuantity} copies</div>
            </div>
            <div className="panel stat" style={{ borderLeft: '4px solid #0ea5e9' }}>
              <div className="stat-label">Gross Catalog Value</div>
              <div className="stat-value">{grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT</div>
            </div>
            <div className="panel stat" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-label">Total Discount</div>
              <div className="stat-value" style={{ color: '#d97706' }}>- {discountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT</div>
            </div>
            <div className="panel stat" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-label">Net Quoted Total</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>
                {netTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
              </div>
            </div>
          </div>

          {/* Cart Lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {lines.map((line, index) => {
              const matched = editions.find(row => row.id === line.editionId);
              const listPrice = matched ? parseFloat(matched.list_price) || 0 : 0;
              const lineQty = Math.max(1, parseInt(line.quantity, 10) || 1);
              const disc = Math.max(0, Math.min(100, parseFloat(line.discountPercent) || 0));
              const gross = listPrice * lineQty;
              const net = gross * (1 - disc / 100);
              const isDuplicate = line.editionId && duplicateIds.includes(line.editionId);

              return (
                <div
                  key={index}
                  className="panel"
                  style={{
                    padding: '14px',
                    border: isDuplicate ? '1px solid #ef4444' : '1px solid var(--border, #e2e8f0)',
                    borderRadius: '8px',
                    background: isDuplicate ? '#fff5f5' : 'transparent'
                  }}
                >
                  <div
                    className="catalog-form-grid"
                    style={{
                      alignItems: 'flex-start',
                      gridTemplateColumns: 'minmax(220px, 3fr) minmax(90px, 1fr) minmax(100px, 1fr) minmax(130px, 1fr) auto'
                    }}
                  >
                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>Book Edition {index + 1}</span>
                        {matched && <span style={{ color: '#0284c7', fontWeight: 600, fontSize: '12px' }}>List: {listPrice.toFixed(2)} BDT</span>}
                      </span>
                      <select
                        className="input"
                        value={line.editionId}
                        onChange={event => changeLine(index, 'editionId', event.target.value)}
                      >
                        <option value="">Select priced edition...</option>
                        {editions.map(row => (
                          <option key={row.id} value={row.id}>
                            {row.book_title} — {row.edition_code || row.id} ({row.list_price} BDT)
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ display: 'block', marginBottom: '4px' }}>Quantity</span>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={event => changeLine(index, 'quantity', event.target.value)}
                      />
                    </label>

                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ display: 'block', marginBottom: '4px' }}>Discount %</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={line.discountPercent}
                        onChange={event => changeLine(index, 'discountPercent', event.target.value)}
                      />
                    </label>

                    <div className="field" style={{ margin: 0 }}>
                      <span className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Net Subtotal</span>
                      <div style={{ padding: '9px 12px', fontWeight: 600, background: '#f8fafc', borderRadius: '6px', textAlign: 'right', border: '1px solid #e2e8f0', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn"
                      disabled={lines.length === 1}
                      onClick={() => setLines(current => current.filter((_, row) => row !== index))}
                      style={{ height: '38px', marginTop: '22px', padding: '0 12px', color: lines.length === 1 ? '#94a3b8' : '#ef4444' }}
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {isDuplicate && (
                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', marginBottom: 0 }}>
                      ⚠️ This edition is already in the offer cart. Please update the existing line.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {quotationHint && (
              <p className="muted" style={{ fontSize: '13px', margin: 0, color: '#d97706' }}>
                ℹ️ {quotationHint}
              </p>
            )}
            <div className="button-row">
              <button
                type="button"
                className="btn"
                disabled={lines.length >= 200}
                onClick={() => setLines(current => [...current, emptyLine()])}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Add Another Edition
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSave || busy}
                onClick={() => void create()}
              >
                {busy ? 'Saving...' : `Save & Activate Quotation (${netTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT)`}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Quotations Table Panel */}
      {!creating && !loading && (
        <div className="panel" style={{ padding: '20px' }}>
          {/* Search and Filters Toolbar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', flex: 1 }}>
              <div style={{ display: 'flex', gap: '6px', minWidth: '280px' }}>
                <input
                  className="input"
                  placeholder="🔍 Search quotation # or customer..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      setPage(0);
                      setSearch(query.trim());
                    }
                  }}
                  style={{ fontSize: '13px' }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPage(0);
                    setSearch(query.trim());
                  }}
                >
                  Search
                </button>
              </div>

              <select
                className="input"
                value={status}
                onChange={e => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
                style={{ fontSize: '13px', width: '160px' }}
              >
                <option value="">All Statuses</option>
                <option value="accepted">Accepted (Active)</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="converted">Converted</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Showing {rows.length} of {total} quotations
              </span>
              <Link
                href="/sales-distribution/create-sales-order"
                className="btn btn-sm"
                style={{ fontSize: '12px', textDecoration: 'none' }}
              >
                📦 Create Order
              </Link>
            </div>
          </div>

          {/* Data Table */}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Quotation #</th>
                  <th style={{ width: '105px' }}>Date</th>
                  <th>Customer</th>
                  <th style={{ width: '120px' }}>Channel</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Lines / Qty</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Gross</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Discount</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Net Total</th>
                  <th style={{ width: '110px' }}>Status</th>
                  <th style={{ width: '190px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <code
                          style={{
                            background: '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#0f172a'
                          }}
                        >
                          {row.quotation_number}
                        </code>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {String(row.quotation_date).slice(0, 10)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {row.customer_name}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: '#f8fafc',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {row.sales_channel || 'General'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#0284c7' }}>
                          {Number(row.quantity).toLocaleString()} copies
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {row.line_count} titles
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '13px' }}>
                        {parseFloat(row.gross_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '13px', color: parseFloat(row.discount_amount) > 0 ? '#d97706' : '#94a3b8' }}>
                        {parseFloat(row.discount_amount) > 0 ? `- ${parseFloat(row.discount_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '0.00'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {parseFloat(row.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                      </td>
                      <td>
                        {renderStatusPill(row.status)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setSelectedId(row.id)}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            Review
                          </button>
                          {row.status !== 'rejected' && (
                            <Link
                              className="btn btn-primary btn-sm"
                              href={`/sales-distribution/create-sales-order?quote=${row.id}`}
                              style={{ padding: '3px 8px', fontSize: '12px', textDecoration: 'none' }}
                            >
                              Order
                            </Link>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm"
                            title="Download Proforma Invoice PDF"
                            onClick={async () => {
                              try {
                                const blob = await apiFile(`/sales/quotations/${row.id}/pdf`);
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `quotation-${row.quotation_number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                              } catch {}
                            }}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            PDF
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ padding: '3px 8px', fontSize: '12px', color: '#ef4444' }}
                              disabled={busy}
                              onClick={() => void deleteQuote(row.id, row.quotation_number)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="empty" style={{ textAlign: 'center', padding: '36px' }}>
                      No quotations match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {total} quotations · page {page + 1} of {Math.ceil(total / 25) || 1}
            </span>
            <div className="button-row">
              <button
                type="button"
                className="btn btn-sm"
                disabled={page === 0}
                onClick={() => setPage(current => current - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={(page + 1) * 25 >= total}
                onClick={() => setPage(current => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Quotation Detail Modal / Workspace */}
      {detail && (
        <section className="panel catalog-form" style={{ marginTop: '24px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h2 className="section-title" style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
                  Quotation {detail.quotation_number}
                </h2>
                {renderStatusPill(detail.status)}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#334155' }}>
                Customer: <strong>{detail.customer_name}</strong> {detail.customer_code ? `(${detail.customer_code})` : ''} · Channel: <strong>{detail.sales_channel || 'General'}</strong>
              </p>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                Quotation Date: {String(detail.quotation_date).slice(0, 10)} · Valid until: {String(detail.valid_until).slice(0, 10)}
              </p>
            </div>
            <div className="button-row">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void downloadPdf()}>
                📄 Download Proforma Invoice (PDF)
              </button>
              {canManage && detail.status !== 'converted' && detail.status !== 'rejected' && (
                <Link className="btn btn-primary" href={`/sales-distribution/create-sales-order?quote=${detail.id}`}>
                  Create Sales Order ➔
                </Link>
              )}
              {canManage && (
                <button
                  type="button"
                  className="btn"
                  style={{ color: '#ef4444' }}
                  disabled={busy}
                  onClick={() => void deleteQuote(detail.id, detail.quotation_number)}
                >
                  🗑 Delete
                </button>
              )}
            </div>
          </div>

          {/* Commercial Stat Grid */}
          <div className="stat-grid" style={{ marginBottom: '18px' }}>
            <div className="panel stat" style={{ borderLeft: '4px solid #4f46e5' }}>
              <div className="stat-label">Total Volume</div>
              <div className="stat-value">{detail.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)} copies</div>
              <span className="muted" style={{ fontSize: '12px' }}>{detail.lines.length} titles</span>
            </div>
            <div className="panel stat" style={{ borderLeft: '4px solid #0ea5e9' }}>
              <div className="stat-label">Gross Subtotal</div>
              <div className="stat-value">{parseFloat(detail.gross_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT</div>
            </div>
            <div className="panel stat" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-label">Agreed Discount</div>
              <div className="stat-value" style={{ color: '#d97706' }}>- {parseFloat(detail.discount_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT</div>
            </div>
            <div className="panel stat" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-label">Net Quoted Total</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>
                {parseFloat(detail.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="table-wrap" style={{ borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Book Title &amp; Edition</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Quantity</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>List Price (MRP)</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Discount</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Net Unit Price</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line, idx) => {
                  const qty = Number(line.quantity) || 1;
                  const listPrice = parseFloat(line.unit_list_price) || 0;
                  const netAmt = parseFloat(line.net_amount) || 0;
                  const netUnit = qty > 0 ? (netAmt / qty) : listPrice;
                  const discBps = Number(line.discount_bps) || 0;
                  const gross = listPrice * qty;
                  const discAmt = gross - netAmt;

                  return (
                    <tr key={line.id || idx}>
                      <td className="muted">{idx + 1}</td>
                      <td>
                        <strong>{line.book_title}</strong>
                        <div className="muted" style={{ fontSize: '11px' }}>
                          {line.edition_code || line.edition_id} {line.format ? `· ${line.format}` : ''}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{qty}</td>
                      <td style={{ textAlign: 'right' }}>{listPrice.toFixed(2)} BDT</td>
                      <td style={{ textAlign: 'right', color: '#d97706' }}>
                        {(discBps / 100).toFixed(1)}% <span className="muted" style={{ fontSize: '11px' }}>(-{discAmt.toFixed(2)})</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{netUnit.toFixed(2)} BDT</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{netAmt.toFixed(2)} BDT</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '13px' }}>
            <p style={{ margin: 0 }}>Payment terms: <strong>{detail.payment_terms || 'Standard publisher terms'}</strong> · Delivery terms: <strong>{detail.delivery_terms || 'Standard delivery'}</strong></p>
            {detail.acceptance_evidence && <p style={{ margin: '4px 0 0' }}>Acceptance evidence: {detail.acceptance_evidence}</p>}
            {detail.rejection_reason && <p style={{ margin: '4px 0 0', color: '#ef4444' }}>Rejection reason: {detail.rejection_reason}</p>}
          </div>

          <div className="button-row">
            {canManage && detail.status !== 'converted' && detail.status !== 'rejected' && (
              <Link className="btn btn-primary" href={`/sales-distribution/create-sales-order?quote=${detail.id}`}>
                Create Sales Order
              </Link>
            )}
            {canManage && (detail.status === 'draft' || detail.status === 'pending_approval') && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void transition('accept')}>
                ✓ Activate Quotation
              </button>
            )}
            {canManage && (
              <button type="button" className="btn" style={{ color: '#ef4444' }} disabled={busy} onClick={() => void deleteQuote(detail.id, detail.quotation_number)}>
                🗑 Delete Quotation
              </button>
            )}
            {canManage && (
              <Link className="btn" href={`/sales-distribution/create-quotation?copy=${detail.id}`}>
                Copy into New Draft
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Revisions and Expiry */}
      {!creating && detail && canManage && detail.status === 'draft' && detail.created_by === userId && (
        <SalesQuotationEditForm
          key={`${detail.id}:${detail.version_no}`}
          detail={detail}
          onSaved={() => {
            void loadList();
            void api<{ data: Detail }>(`/sales/quotations/${detail.id}`).then(result => setDetail(result.data)).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not reload quotation'));
          }}
        />
      )}
      {!creating && detail && revisions.length > 0 && (
        <section className="panel catalog-form" style={{ marginTop: '20px' }}>
          <h2 className="section-title">Saved quotation versions</h2>
          <p className="muted">These are immutable price and term snapshots from saves.</p>
          {revisions.map(revision => (
            <details key={revision.version} style={{ marginBottom: '8px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                Version {revision.version} · {revision.snapshot.header.total_amount} BDT · {String(revision.changedAt).slice(0, 19).replace('T', ' ')}
              </summary>
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '4px', marginTop: '6px' }}>
                <p style={{ margin: '0 0 4px' }}>Number: {revision.snapshot.header.quotation_number} · Customer ID: {revision.snapshot.header.customer_id}</p>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {revision.snapshot.lines.map(line => (
                    <li key={line.edition_id}>
                      Edition {line.edition_id} · {line.quantity} × {line.unit_list_price} BDT · {(Number(line.discount_bps) / 100).toFixed(2)}% discount · {line.net_amount} BDT
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </section>
      )}
      {!creating && detail && (
        <SalesQuotationExpiryPanel
          key={detail.id}
          id={detail.id}
          validUntil={detail.valid_until}
          status={detail.status}
          creatorId={detail.created_by}
          userId={userId}
          canManage={canManage}
          canApprove={canApprove}
        />
      )}
    </>
  );
}
