"use client";

import { useEffect, useState } from 'react';
import { Trash2, Plus, AlertCircle, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';

type Customer = { id: string; customer_code: string; name: string };
type Edition = { id: string; book_title: string; edition_code: string | null; list_price: string };
type Line = { editionId: string; quantity: number; discountPercent: number };
export type EditableQuotation = { id: string; version_no: number; created_by: string; quotation_number: string; customer_id: string; quotation_date: string; valid_until: string; sales_channel: string; payment_terms: string | null; delivery_terms: string | null; notes: string | null; lines: Array<{ edition_id: string; quantity: number; discount_bps: number }> };

export function SalesQuotationEditForm({ detail, onSaved }: { detail: EditableQuotation; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(detail.quotation_number);
  const [customerId, setCustomerId] = useState(detail.customer_id);
  const [quotationDate, setQuotationDate] = useState(String(detail.quotation_date).slice(0, 10));
  const [validUntil, setValidUntil] = useState(String(detail.valid_until).slice(0, 10));
  const [channel, setChannel] = useState(detail.sales_channel);
  const [paymentTerms, setPaymentTerms] = useState(detail.payment_terms || '');
  const [deliveryTerms, setDeliveryTerms] = useState(detail.delivery_terms || '');
  const [notes, setNotes] = useState(detail.notes || '');
  const [lines, setLines] = useState<Line[]>(detail.lines.map(row => ({ editionId: row.edition_id, quantity: Number(row.quantity), discountPercent: Number(row.discount_bps) / 100 })));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    void api<{ data: { customers: Customer[]; editions: Edition[] } }>(`/sales/quotations/options?asOf=${quotationDate}`)
      .then(result => { setCustomers(result.data.customers); setEditions(result.data.editions); })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load current prices'));
  }, [editing, quotationDate]);

  const editionMap = new Map(editions.map(e => [e.id, e]));
  const selectedEditionIds = lines.map(l => l.editionId).filter(Boolean);
  const duplicateIds = selectedEditionIds.filter((id, idx) => selectedEditionIds.indexOf(id) !== idx);
  const hasDuplicates = duplicateIds.length > 0;

  const totalQuantity = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  const grossTotal = lines.reduce((sum, l) => {
    const ed = editionMap.get(l.editionId);
    return sum + (ed ? (parseFloat(ed.list_price) || 0) * (Number(l.quantity) || 0) : 0);
  }, 0);
  const discountTotal = lines.reduce((sum, l) => {
    const ed = editionMap.get(l.editionId);
    const price = ed ? (parseFloat(ed.list_price) || 0) : 0;
    const gross = price * (Number(l.quantity) || 0);
    const disc = Math.max(0, Math.min(100, Number(l.discountPercent) || 0)) / 100;
    return sum + (gross * disc);
  }, 0);
  const netTotal = grossTotal - discountTotal;

  const allLinesValid = lines.length > 0 && lines.every(line => line.editionId && Number.isInteger(line.quantity) && line.quantity > 0 && Number.isFinite(line.discountPercent) && line.discountPercent >= 0 && line.discountPercent <= 100);
  const valid = number.trim().length >= 2 && customerId && validUntil >= quotationDate && channel.trim().length >= 2 && allLinesValid && !hasDuplicates;

  async function save() {
    if (!valid) return;
    setBusy(true); setError('');
    try {
      await api(`/sales/quotations/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: Number(detail.version_no),
          quotationNumber: number.trim(),
          customerId,
          quotationDate,
          validUntil,
          salesChannel: channel.trim(),
          paymentTerms: paymentTerms.trim(),
          deliveryTerms: deliveryTerms.trim(),
          notes: notes.trim(),
          lines: lines.map(line => ({ editionId: line.editionId, quantity: line.quantity, discountBps: Math.round(line.discountPercent * 100) }))
        })
      });
      setEditing(false);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save draft quotation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel catalog-form">
      <div className="button-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>Draft Quotation Terms Editor</h2>
          <p className="muted" style={{ margin: 0 }}>Recalculates edition prices from the Catalog list price active on the quotation date.</p>
        </div>
        <button type="button" className="btn" onClick={() => setEditing(value => !value)}>
          {editing ? 'Close Editor' : 'Edit Quotation Terms'}
        </button>
      </div>

      {editing && (
        <>
          <p className="muted" style={{ marginTop: '12px' }}>
            Saving recalculates line prices from the Catalog price effective on the chosen quotation date. A stale version is rejected.
          </p>

          {error && <p className="alert-error" role="alert">{error}</p>}
          {hasDuplicates && (
            <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span><strong>Duplicate Edition in Offer:</strong> Each book edition can only appear once. Please combine the quantities.</span>
            </div>
          )}

          <div className="catalog-form-grid">
            <label className="field">Quotation number<input className="input" value={number} onChange={event => setNumber(event.target.value)} /></label>
            <label className="field">Customer<select className="input" value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="">Select customer</option>{customers.map(row => <option key={row.id} value={row.id}>{row.customer_code} - {row.name}</option>)}</select></label>
            <label className="field">Quotation date<input className="input" type="date" value={quotationDate} onChange={event => setQuotationDate(event.target.value)} /></label>
            <label className="field">Valid until<input className="input" type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} /></label>
            <label className="field">Sales channel<input className="input" value={channel} onChange={event => setChannel(event.target.value)} /></label>
            <label className="field">Payment terms<input className="input" value={paymentTerms} onChange={event => setPaymentTerms(event.target.value)} /></label>
            <label className="field">Delivery terms<input className="input" value={deliveryTerms} onChange={event => setDeliveryTerms(event.target.value)} /></label>
            <label className="field">Notes<input className="input" value={notes} onChange={event => setNotes(event.target.value)} /></label>
          </div>

          <div style={{ marginTop: '20px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="section-title" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <ShoppingCart size={16} /> Offered Edition Items ({lines.length})
            </h3>
            <span style={{ fontWeight: 600, color: '#16a34a' }}>
              Net Quoted: {netTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT ({totalQuantity} copies)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {lines.map((line, index) => {
              const ed = editionMap.get(line.editionId);
              const unitPrice = ed ? parseFloat(ed.list_price) || 0 : 0;
              const gross = unitPrice * (Number(line.quantity) || 0);
              const discPercent = Math.max(0, Math.min(100, Number(line.discountPercent) || 0));
              const net = gross * (1 - discPercent / 100);
              const isDuplicate = line.editionId && duplicateIds.includes(line.editionId);

              return (
                <div
                  key={index}
                  className="panel"
                  style={{
                    padding: '12px',
                    border: isDuplicate ? '1px solid #ef4444' : '1px solid var(--border, #e2e8f0)',
                    borderRadius: '8px',
                    background: isDuplicate ? '#fff5f5' : 'transparent'
                  }}
                >
                  <div className="catalog-form-grid" style={{ alignItems: 'flex-end', gridTemplateColumns: 'minmax(200px, 3fr) minmax(90px, 1fr) minmax(90px, 1fr) minmax(130px, 1fr) auto' }}>
                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Edition {index + 1}</span>
                        {ed && <span style={{ color: '#0284c7', fontWeight: 600 }}>{unitPrice.toFixed(2)} BDT</span>}
                      </span>
                      <select
                        className="input"
                        value={line.editionId}
                        onChange={event => setLines(current => current.map((row, i) => i === index ? { ...row, editionId: event.target.value } : row))}
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
                      Quantity
                      <input
                        className="input"
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={event => setLines(current => current.map((row, i) => i === index ? { ...row, quantity: Math.max(1, parseInt(String(event.target.value), 10) || 1) } : row))}
                      />
                    </label>

                    <label className="field" style={{ margin: 0 }}>
                      Discount %
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={line.discountPercent}
                        onChange={event => setLines(current => current.map((row, i) => i === index ? { ...row, discountPercent: Math.max(0, Math.min(100, parseFloat(event.target.value) || 0)) } : row))}
                      />
                    </label>

                    <div className="field" style={{ margin: 0 }}>
                      <span className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Net Subtotal</span>
                      <div style={{ padding: '9px 12px', fontWeight: 600, background: '#f8fafc', borderRadius: '6px', textAlign: 'right', border: '1px solid #e2e8f0' }}>
                        {net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn"
                      disabled={lines.length === 1}
                      onClick={() => setLines(current => current.filter((_, i) => i !== index))}
                      style={{ height: '42px', padding: '0 14px', color: lines.length === 1 ? '#94a3b8' : '#ef4444' }}
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {isDuplicate && (
                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                      ⚠️ Duplicate edition in cart. Please merge line quantities.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              disabled={lines.length >= 200}
              onClick={() => setLines(current => [...current, { editionId: '', quantity: 1, discountPercent: 0 }])}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} /> Add Another Edition
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!valid || busy}
              onClick={() => void save()}
            >
              {busy ? 'Saving...' : `Save Draft Changes (${netTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT)`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
