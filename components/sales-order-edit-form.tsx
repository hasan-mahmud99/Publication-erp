"use client";

import { useEffect, useState } from 'react';
import { Trash2, Plus, AlertCircle, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';

type Customer = { id: string; customer_code: string; name: string };
type Edition = { id: string; book_title: string; edition_code: string | null; list_price: string };
type Line = { editionId: string; quantity: number };
export type EditableOrder = { id: string; version_no: number; order_number: string; customer_id: string; order_date: string; lines: Array<{ edition_id: string; quantity: number }> };

export function SalesOrderEditForm({ order, onSaved }: { order: EditableOrder; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(order.order_number);
  const [customerId, setCustomerId] = useState(order.customer_id);
  const [orderDate, setOrderDate] = useState(String(order.order_date).slice(0, 10));
  const [lines, setLines] = useState<Line[]>(order.lines.map(row => ({ editionId: row.edition_id, quantity: Number(row.quantity) })));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    void api<{ data: { customers: Customer[]; editions: Edition[] } }>(`/sales/quotations/options?asOf=${orderDate}`)
      .then(result => { setCustomers(result.data.customers); setEditions(result.data.editions); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load current list prices'));
  }, [editing, orderDate]);

  const editionMap = new Map(editions.map(e => [e.id, e]));
  const selectedEditionIds = lines.map(l => l.editionId).filter(Boolean);
  const duplicateIds = selectedEditionIds.filter((id, idx) => selectedEditionIds.indexOf(id) !== idx);
  const hasDuplicates = duplicateIds.length > 0;

  const totalUnits = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  const grandTotal = lines.reduce((sum, l) => {
    const ed = editionMap.get(l.editionId);
    return sum + (ed ? (parseFloat(ed.list_price) || 0) * (Number(l.quantity) || 0) : 0);
  }, 0);

  const allLinesValid = lines.length > 0 && lines.every(line => line.editionId && Number.isInteger(line.quantity) && line.quantity > 0);
  const valid = number.trim().length >= 2 && customerId && orderDate && allLinesValid && !hasDuplicates;

  async function save() {
    if (!valid) return;
    setBusy(true); setError('');
    try {
      await api(`/sales/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: Number(order.version_no),
          orderNumber: number.trim(),
          customerId,
          orderDate,
          lines
        })
      });
      setEditing(false);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save draft order');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel catalog-form">
      <div className="button-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>Manual Draft Order Editor</h2>
          <p className="muted" style={{ margin: 0 }}>Edit unlinked manual draft before approval or reservation.</p>
        </div>
        <button type="button" className="btn" onClick={() => setEditing(value => !value)}>
          {editing ? 'Close Editor' : 'Edit Draft Items'}
        </button>
      </div>

      {editing && (
        <>
          <p className="muted" style={{ marginTop: '12px' }}>
            Saving recalculates every edition from the active Catalog list price on the selected order date. Quotation-linked orders cannot be edited.
          </p>

          {error && <p className="alert-error" role="alert">{error}</p>}
          {hasDuplicates && (
            <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span><strong>Duplicate Edition in Cart:</strong> Each book edition can only be added once. Please combine the quantities.</span>
            </div>
          )}

          <div className="catalog-form-grid">
            <label className="field">
              Sales order number
              <input className="input" value={number} onChange={event => setNumber(event.target.value)} />
            </label>
            <label className="field">
              Customer
              <select className="input" value={customerId} onChange={event => setCustomerId(event.target.value)}>
                <option value="">Select customer</option>
                {customers.map(row => <option key={row.id} value={row.id}>{row.customer_code} - {row.name}</option>)}
              </select>
            </label>
            <label className="field">
              Order date
              <input className="input" type="date" value={orderDate} onChange={event => setOrderDate(event.target.value)} />
            </label>
          </div>

          <div style={{ marginTop: '20px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="section-title" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <ShoppingCart size={16} /> Order Cart Items ({lines.length})
            </h3>
            <span style={{ fontWeight: 600, color: '#16a34a' }}>
              Total: {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT ({totalUnits} copies)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {lines.map((line, index) => {
              const ed = editionMap.get(line.editionId);
              const unitPrice = ed ? parseFloat(ed.list_price) || 0 : 0;
              const lineTotal = unitPrice * (Number(line.quantity) || 0);
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
                  <div className="catalog-form-grid" style={{ alignItems: 'flex-end', gridTemplateColumns: 'minmax(200px, 3fr) minmax(100px, 1fr) minmax(120px, 1fr) auto' }}>
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
                        onChange={event => setLines(current => current.map((row, i) => i === index ? { ...row, quantity: Math.max(1, parseInt(event.target.value, 10) || 1) } : row))}
                      />
                    </label>

                    <div className="field" style={{ margin: 0 }}>
                      <span className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Subtotal</span>
                      <div style={{ padding: '9px 12px', fontWeight: 600, background: '#f8fafc', borderRadius: '6px', textAlign: 'right', border: '1px solid #e2e8f0' }}>
                        {lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn"
                      disabled={lines.length === 1}
                      onClick={() => setLines(current => current.filter((_, i) => i !== index))}
                      style={{ height: '42px', padding: '0 14px', color: lines.length === 1 ? '#94a3b8' : '#ef4444' }}
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
              onClick={() => setLines(current => [...current, { editionId: '', quantity: 1 }])}
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
              {busy ? 'Saving...' : `Save Draft Changes (${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT)`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
