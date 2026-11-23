"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, ShoppingCart, AlertCircle, FileText, CheckCircle2, ShieldCheck, Tag } from 'lucide-react';
import { api } from '@/lib/api';

type Customer = { id: string; name: string; customer_code: string };
type Edition = { id: string; book_title: string; edition_code: string | null; list_price: string; available_stock?: string | number; on_hand_stock?: string | number };
type QuoteOption = { id: string; quotation_number: string; customer_name: string; customer_id?: string; total_amount: string; status?: string };
type QuoteRule = {
  editionId: string;
  minQuantity: number;
  discountPercent: number;
  quotationLineId: string;
  bookTitle?: string;
};
type Line = { editionId: string; quantity: number };

export function ManualSalesOrderForm({ canManage, initialQuoteId }: { canManage: boolean; initialQuoteId?: string }) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [quotes, setQuotes] = useState<QuoteOption[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState(initialQuoteId || '');
  const [appliedQuoteNumber, setAppliedQuoteNumber] = useState('');
  const [quoteRules, setQuoteRules] = useState<Map<string, QuoteRule>>(new Map());
  const [customerId, setCustomerId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [lines, setLines] = useState<Line[]>([{ editionId: '', quantity: 1 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prefilledFrom, setPrefilledFrom] = useState<{ number: string; customerName: string; lineCount: number } | null>(null);
  const [selectedFromInventory, setSelectedFromInventory] = useState<Edition | null>(null);

  // Payment & Settlement State
  const [settlementType, setSettlementType] = useState<'full' | 'partial' | 'credit'>('full');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [customPaidAmount, setCustomPaidAmount] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  useEffect(() => {
    void Promise.all([
      api<{ data: { customers: Customer[]; editions: Edition[] } }>('/sales/quotations/options'),
      api<{ data: { rows: QuoteOption[] } }>('/sales/quotations?limit=100')
    ]).then(([opts, quotesRes]) => {
      setCustomers(opts.data.customers);
      setEditions(opts.data.editions);
      setQuotes((quotesRes.data.rows || []).filter(r => r.status !== 'rejected'));
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load form options'));
  }, []);

  // When editionId is passed from Inventory Overview or Stock By Book/Edition
  useEffect(() => {
    if (typeof window === 'undefined' || !editions.length) return;
    const params = new URLSearchParams(window.location.search);
    const editionParam = params.get('editionId') || params.get('edition_id');
    if (editionParam) {
      const match = editions.find(e => e.id === editionParam || e.edition_code === editionParam);
      if (match) {
        setSelectedFromInventory(match);
        setLines(current => {
          if (current.length === 1 && !current[0].editionId) {
            return [{ editionId: match.id, quantity: 1 }];
          }
          if (!current.some(l => l.editionId === match.id)) {
            return [{ editionId: match.id, quantity: 1 }, ...current.filter(l => l.editionId)];
          }
          return current;
        });
      }
    }
  }, [editions]);

  // When initialQuoteId is provided or detected in URL search parameters
  useEffect(() => {
    const qParam = initialQuoteId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('quote') : null);
    if (qParam && quotes.length && !selectedQuoteId) {
      void handleSelectQuotation(qParam);
    }
  }, [quotes, initialQuoteId]);

  async function handleSelectQuotation(quoteId: string) {
    setSelectedQuoteId(quoteId);
    if (!quoteId) {
      setAppliedQuoteNumber('');
      setQuoteRules(new Map());
      setPrefilledFrom(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api<{ data: any }>(`/sales/quotations/${quoteId}`);
      const q = res.data;
      if (q) {
        setCustomerId(q.customer_id);
        setAppliedQuoteNumber(q.quotation_number);
        setOrderNumber(prev => prev && !prev.startsWith('SO-') ? prev : `SO-${q.quotation_number}`);

        const rules = new Map<string, QuoteRule>();
        if (Array.isArray(q.lines)) {
          for (const l of q.lines) {
            rules.set(l.edition_id, {
              editionId: l.edition_id,
              minQuantity: Number(l.quantity) || 1,
              discountPercent: (Number(l.discount_bps) || 0) / 100,
              quotationLineId: l.id,
              bookTitle: l.book_title
            });
          }
        }
        setQuoteRules(rules);

        if (q.lines && q.lines.length > 0) {
          setLines(q.lines.map((l: any) => ({
            editionId: l.edition_id,
            quantity: Number(l.quantity) || 1
          })));
        }

        setPrefilledFrom({
          number: q.quotation_number,
          customerName: q.customer_name || 'Customer',
          lineCount: q.lines?.length || 0
        });
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Could not load quotation details');
    } finally {
      setBusy(false);
    }
  }

  const editionMap = new Map(editions.map(e => [e.id, e]));
  const selectedEditionIds = lines.map(l => l.editionId).filter(Boolean);
  const duplicateIds = selectedEditionIds.filter((id, idx) => selectedEditionIds.indexOf(id) !== idx);
  const hasDuplicates = duplicateIds.length > 0;

  // Helper to calculate line auto-discount based on quotation terms
  function getLinePricing(line: Line) {
    const ed = editionMap.get(line.editionId);
    const unitPrice = ed ? parseFloat(ed.list_price) || 0 : 0;
    const qty = Math.max(1, Number(line.quantity) || 1);
    const gross = unitPrice * qty;

    const availableStock = ed ? Number(ed.available_stock || 0) : 0;
    const isShortage = Boolean(ed && qty > availableStock);
    const shortageQty = isShortage ? qty - availableStock : 0;

    const rule = selectedQuoteId && line.editionId ? quoteRules.get(line.editionId) : null;
    const isEligible = rule ? qty >= rule.minQuantity : false;
    const discountPercent = isEligible && rule ? rule.discountPercent : 0;
    const discountAmount = gross * (discountPercent / 100);
    const net = Math.max(0, gross - discountAmount);

    return {
      unitPrice,
      qty,
      gross,
      availableStock,
      isShortage,
      shortageQty,
      rule: rule || null,
      isEligible,
      discountPercent,
      discountAmount,
      net
    };
  }

  const totalItems = lines.filter(l => l.editionId).length;
  const totalUnits = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

  let grossTotal = 0;
  let totalDiscount = 0;
  let netGrandTotal = 0;

  for (const line of lines) {
    const p = getLinePricing(line);
    grossTotal += p.gross;
    totalDiscount += p.discountAmount;
    netGrandTotal += p.net;
  }

  const effectivePaidAmount = settlementType === 'full'
    ? netGrandTotal
    : settlementType === 'credit'
      ? 0
      : Math.min(netGrandTotal, Math.max(0, parseFloat(customPaidAmount) || 0));

  const effectiveDueAmount = Math.max(0, netGrandTotal - effectivePaidAmount);

  const allLinesFilled = lines.length > 0 && lines.every(line => line.editionId && Number.isInteger(line.quantity) && line.quantity > 0);
  const valid = canManage && customerId && orderNumber.trim().length >= 2 && allLinesFilled && !hasDuplicates;

  function getValidationReason(): string | null {
    if (!canManage) return 'You do not have permission to create sales orders';
    if (!customerId) return 'Please select a customer';
    if (orderNumber.trim().length < 2) return 'Please enter an order number (at least 2 characters)';
    if (!allLinesFilled) return 'Please select a valid edition and enter quantity for all items';
    if (hasDuplicates) return 'Duplicate book editions detected in the cart. Each edition can only be added once';
    return null;
  }

  async function create() {
    if (!valid) return;
    setBusy(true); setError('');
    try {
      const order = (await api<{ data: { id: string } }>('/sales/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          customerId,
          orderNumber: orderNumber.trim(),
          quotationId: selectedQuoteId || null,
          paymentMethod: settlementType === 'credit' ? 'credit' : paymentMethod,
          paidAmount: effectivePaidAmount,
          paymentReference: paymentRef.trim() || null,
          paymentNotes: paymentNotes.trim() || null,
          lines: lines.map(l => {
            const p = getLinePricing(l);
            return {
              editionId: l.editionId,
              quantity: l.quantity,
              discountBps: Math.round(p.discountPercent * 100),
              quotationLineId: p.rule ? p.rule.quotationLineId : null
            };
          })
        })
      })).data;
      router.push(`/sales-distribution/sales-order-detail?order=${order.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create order');
    } finally {
      setBusy(false);
    }
  }

  const validationHint = getValidationReason();

  return (
    <section className="panel catalog-form">
      <div className="section-head">
        <div>
          <h2 className="section-title">Create Sales Order</h2>
          <p className="muted">
            Place sales orders easily. Connect with an existing quotation to automatically detect agreed discounts when quantity meets the threshold (e.g. 500+ copies).
          </p>
        </div>
      </div>

      {error && <p className="alert-error" role="alert">{error}</p>}
      {prefilledFrom && (
        <div className="alert-success" role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <strong>✓ Quotation {prefilledFrom.number} connected:</strong> Customer <strong>{prefilledFrom.customerName}</strong> and items loaded. Discounts unlock automatically once the quantity meets the quotation threshold.
          </div>
          <button
            type="button"
            className="btn"
            style={{ fontSize: '12px', padding: '2px 8px', height: 'auto' }}
            onClick={() => setPrefilledFrom(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {hasDuplicates && (
        <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span><strong>Duplicate Edition in Cart:</strong> Each book edition can only be added once per order. Please adjust the quantity on the existing line instead.</span>
        </div>
      )}

      {selectedFromInventory && (
        <div style={{
          marginBottom: '16px',
          padding: '14px 18px',
          borderRadius: '8px',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🛍️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#166534', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Selling Pre-Selected Publication from Inventory
                <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  Auto-Selected
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#15803d', marginTop: '2px' }}>
                <strong>{selectedFromInventory.book_title}</strong> ({selectedFromInventory.edition_code || 'Edition'}) · 
                Catalog MRP: <strong>BDT {parseFloat(selectedFromInventory.list_price || '0').toFixed(2)}</strong> · 
                Available Floor Stock: <strong>{Number(selectedFromInventory.available_stock || 0)} copies</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn"
            style={{ fontSize: '12px', padding: '4px 10px', height: 'auto', background: '#fff', borderColor: '#86efac', color: '#166534' }}
            onClick={() => setSelectedFromInventory(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quotation Connection Dropdown */}
      <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <label className="field" style={{ margin: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <FileText size={16} color="#0284c7" /> Connect with Quotation (Optional)
          </span>
          <select
            className="input"
            value={selectedQuoteId}
            onChange={e => void handleSelectQuotation(e.target.value)}
            disabled={busy}
          >
            <option value="">None (Standard Order at regular list price)</option>
            {quotes.map(q => (
              <option key={q.id} value={q.id}>
                {q.quotation_number} — {q.customer_name} ({q.total_amount} BDT)
              </option>
            ))}
          </select>
        </label>
        {appliedQuoteNumber && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', color: '#16a34a', fontSize: '13px', fontWeight: 500 }}>
            <CheckCircle2 size={16} />
            <span>
              Connected to Quotation <strong>{appliedQuoteNumber}</strong>. When you order <strong>500+ copies</strong> (or the quotation threshold), the <strong>10% discount</strong> is automatically detected and deducted.
            </span>
          </div>
        )}
      </div>

      <div className="catalog-form-grid">
        <label className="field">
          Customer *
          <select
            className="input"
            value={customerId}
            onChange={event => {
              setCustomerId(event.target.value);
              // If user changes customer and active quote doesn't belong to them, reset quotation
              if (selectedQuoteId) {
                const q = quotes.find(item => item.id === selectedQuoteId);
                if (q && q.customer_id && q.customer_id !== event.target.value) {
                  setSelectedQuoteId('');
                  setAppliedQuoteNumber('');
                  setQuoteRules(new Map());
                }
              }
            }}
          >
            <option value="">Select customer</option>
            {customers.map(row => <option key={row.id} value={row.id}>{row.customer_code} - {row.name}</option>)}
          </select>
        </label>
        <label className="field">
          Sales order number *
          <input className="input" placeholder="e.g. SO-2026-001" value={orderNumber} onChange={event => setOrderNumber(event.target.value)} />
        </label>
      </div>

      <div style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="section-title" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <ShoppingCart size={16} /> Order Cart & Book Items ({lines.length})
        </h3>
        <button
          type="button"
          className="btn"
          disabled={lines.length >= 200}
          onClick={() => setLines(current => [...current, { editionId: '', quantity: 1 }])}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={14} /> Add Edition to Cart
        </button>
      </div>

      {/* Cart Summary KPI */}
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
            background: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            📦 Cart Items &amp; Units
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalUnits} copies
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            {totalItems} distinct titles selected
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #0ea5e9',
            background: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
            🏷️ Gross List Value
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
            {grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Regular MRP catalog subtotal
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: totalDiscount > 0 ? '4px solid #10b981' : '4px solid #f59e0b',
            background: totalDiscount > 0 ? '#ecfdf5' : '#fffbeb',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: totalDiscount > 0 ? '#059669' : '#d97706', textTransform: 'uppercase' }}>
            ✨ Auto-Applied Discount
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: totalDiscount > 0 ? '#065f46' : '#92400e', marginTop: '4px' }}>
            {totalDiscount > 0 ? `- ${totalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT` : '0.00 BDT'}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            {totalDiscount > 0 ? 'Quotation threshold unlocked' : 'Unlocks at ≥ 500 copies (from quotation)'}
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #10b981',
            background: '#ecfdf5',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            💳 Net Payable Total
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {netGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Final order subtotal before checkout
          </div>
        </div>
      </div>

      {/* Cart Lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {lines.map((line, index) => {
          const pricing = getLinePricing(line);
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
                  gridTemplateColumns: 'minmax(220px, 3fr) minmax(90px, 1fr) minmax(230px, 2fr) minmax(130px, 1.2fr) auto'
                }}
              >
                {/* 1. Book Edition */}
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
                    <span>Book Edition {index + 1}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {pricing.unitPrice > 0 && (
                        <span style={{ color: '#0284c7', fontWeight: 600, fontSize: '12px' }}>
                          List: {pricing.unitPrice.toFixed(2)} BDT
                        </span>
                      )}
                      {line.editionId && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: pricing.availableStock > 0 ? '#ecfdf5' : '#fef2f2',
                            color: pricing.availableStock > 0 ? '#065f46' : '#991b1b',
                            border: `1px solid ${pricing.availableStock > 0 ? '#a7f3d0' : '#fecaca'}`,
                          }}
                        >
                          {pricing.availableStock > 0 ? `📦 Stock: ${pricing.availableStock} pcs` : '⚠️ Stock: 0 pcs'}
                        </span>
                      )}
                    </span>
                  </span>
                  <select
                    className="input"
                    value={line.editionId}
                    onChange={event => setLines(current => current.map((row, i) => i === index ? { ...row, editionId: event.target.value } : row))}
                  >
                    <option value="">Select priced edition...</option>
                    {editions.map(row => (
                      <option key={row.id} value={row.id}>
                        {row.book_title} — {row.edition_code || row.id} ({row.list_price} BDT) · Stock: {Number(row.available_stock || 0)} pcs
                      </option>
                    ))}
                  </select>
                </label>

                {/* 2. Quantity (Input only) */}
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ display: 'block', marginBottom: '4px' }}>Quantity</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={event => setLines(current => current.map((row, i) => i === index ? { ...row, quantity: Math.max(1, parseInt(event.target.value, 10) || 1) } : row))}
                  />
                </label>

                {/* 3. Automatic Discount Status from Quotation (NO manual input) */}
                <div className="field" style={{ margin: 0 }}>
                  <span className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    Discount (Auto-detected)
                  </span>
                  {pricing.rule ? (
                    pricing.isEligible ? (
                      <div style={{ padding: '8px 10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', color: '#065f46' }}>
                          <CheckCircle2 size={15} color="#059669" />
                          <span>{pricing.rule.discountPercent}% Quotation Discount</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#047857', marginTop: '3px' }}>
                          ✓ Ordered {pricing.qty} pcs (Threshold ≥ {pricing.rule.minQuantity} pcs met) · Saves -{pricing.discountAmount.toFixed(2)} BDT
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', color: '#92400e' }}>
                          <Tag size={14} color="#d97706" />
                          <span>0% (Regular List Price)</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#b45309', marginTop: '3px' }}>
                          Ordered {pricing.qty} pcs · Need ≥ {pricing.rule.minQuantity} pcs for {pricing.rule.discountPercent}% discount (Short by {pricing.rule.minQuantity - pricing.qty} pcs)
                        </div>
                      </div>
                    )
                  ) : (
                    <div style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#64748b', fontSize: '13px' }}>
                      0% (Regular List Price)
                    </div>
                  )}
                </div>

                {/* 4. Net Subtotal */}
                <div className="field" style={{ margin: 0 }}>
                  <span className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Net Subtotal</span>
                  <div style={{ padding: '9px 12px', fontWeight: 600, background: '#f8fafc', borderRadius: '6px', textAlign: 'right', border: '1px solid #e2e8f0', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {pricing.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                  </div>
                </div>

                {/* 5. Remove Button */}
                <button
                  type="button"
                  className="btn"
                  title="Remove item"
                  disabled={lines.length === 1}
                  onClick={() => setLines(current => current.filter((_, i) => i !== index))}
                  style={{ height: '38px', marginTop: '22px', padding: '0 12px', color: lines.length === 1 ? '#94a3b8' : '#ef4444' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {pricing.isShortage && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={15} color="#d97706" />
                  <span>
                    <strong>Warehouse Stock Shortage:</strong> You requested <strong>{pricing.qty} copies</strong>, but current available warehouse inventory has <strong>{pricing.availableStock} copies</strong> (Short by <strong>{pricing.shortageQty} copies</strong>). The order can still be placed as a confirmed backorder or produced via Printing &amp; Production.
                  </span>
                </div>
              )}

              {isDuplicate && (
                <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', marginBottom: 0 }}>
                  ⚠️ This edition is duplicated in your cart. Combine the quantity into one line.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Payment Methods & Due Settlement Card */}
      <div
        className="panel"
        style={{
          marginTop: '24px',
          padding: '20px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
              <span>💳</span> Payment Methods &amp; Due Settlement (বিল ও মূল্য পরিশোধ)
            </h3>
            <p className="muted" style={{ margin: '3px 0 0', fontSize: '12.5px' }}>
              Choose whether the sale is paid upfront in cash, MFS (bKash/Nagad), bank transfer, or on credit terms with outstanding due.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {effectiveDueAmount === 0 ? (
              <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                ✓ Fully Settled (Zero Due)
              </span>
            ) : (
              <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                ⚠️ Outstanding Due: ৳{effectiveDueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {/* 1. Settlement Type Selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px', color: '#334155' }}>
            Payment Settlement Plan *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <div
              onClick={() => {
                setSettlementType('full');
                setCustomPaidAmount('');
              }}
              style={{
                cursor: 'pointer',
                padding: '12px 16px',
                borderRadius: '8px',
                border: settlementType === 'full' ? '2px solid #10b981' : '1px solid #e2e8f0',
                background: settlementType === 'full' ? '#ecfdf5' : '#f8fafc',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: settlementType === 'full' ? '#065f46' : '#1e293b' }}>
                  🟢 Full Upfront Payment
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>
                  100% Paid
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                Customer pays total ৳{netGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} immediately. No remaining due.
              </div>
            </div>

            <div
              onClick={() => {
                setSettlementType('partial');
                if (!customPaidAmount) setCustomPaidAmount(String(Math.round(netGrandTotal * 0.5)));
              }}
              style={{
                cursor: 'pointer',
                padding: '12px 16px',
                borderRadius: '8px',
                border: settlementType === 'partial' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                background: settlementType === 'partial' ? '#eff6ff' : '#f8fafc',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: settlementType === 'partial' ? '#1d4ed8' : '#1e293b' }}>
                  🔵 Partial Advance + Due
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                  Advance Deposit
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                Customer pays partial deposit now; balance recorded as accounts receivable due.
              </div>
            </div>

            <div
              onClick={() => {
                setSettlementType('credit');
                setCustomPaidAmount('0');
              }}
              style={{
                cursor: 'pointer',
                padding: '12px 16px',
                borderRadius: '8px',
                border: settlementType === 'credit' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                background: settlementType === 'credit' ? '#fffbeb' : '#f8fafc',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: settlementType === 'credit' ? '#b45309' : '#1e293b' }}>
                  🟠 Full Credit / Due
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706' }}>
                  0% Paid Now
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                Full order on credit terms (e.g. Net 30/60 days for wholesale distributors/libraries).
              </div>
            </div>
          </div>
        </div>

        {/* 2. Payment Method and Amount Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          {settlementType !== 'credit' && (
            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Payment Method *</span>
              <select
                className="input"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                style={{ fontSize: '13px', fontWeight: 600 }}
              >
                <option value="cash">💵 Cash in Hand (নগদ ক্যাশ)</option>
                <option value="bkash">📱 bKash Merchant (বিকাশ মার্চেন্ট)</option>
                <option value="nagad">📱 Nagad Merchant (নগদ মার্চেন্ট)</option>
                <option value="bank_transfer">🏦 Bank Transfer (DBBL / BRAC)</option>
                <option value="cheque">📜 Bank Cheque (ব্যাংক চেক)</option>
              </select>
            </label>
          )}

          {settlementType === 'partial' && (
            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Advance Paid Amount (৳) *</span>
              <input
                className="input"
                type="number"
                min="0"
                max={netGrandTotal}
                step="0.01"
                placeholder="Enter paid amount"
                value={customPaidAmount}
                onChange={e => setCustomPaidAmount(e.target.value)}
                style={{ fontSize: '13px', fontWeight: 700 }}
              />
            </label>
          )}

          {settlementType !== 'credit' && (
            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Transaction / Reference No.</span>
              <input
                className="input"
                placeholder={
                  paymentMethod === 'bkash' ? 'e.g. bKash TrxID (e.g. BL991AX4)' :
                  paymentMethod === 'nagad' ? 'e.g. Nagad TrxID (e.g. NGD78821)' :
                  paymentMethod === 'cheque' ? 'e.g. Cheque No & Bank name' :
                  paymentMethod === 'bank_transfer' ? 'e.g. Deposit Slip / Ref No' :
                  'Cash receipt reference (optional)'
                }
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                style={{ fontSize: '13px' }}
              />
            </label>
          )}

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Payment &amp; Terms Notes</span>
            <input
              className="input"
              placeholder="e.g. Due payable within 15 days, verified by cashier"
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              style={{ fontSize: '13px' }}
            />
          </label>
        </div>

        {/* 3. Settlement Summary Footprint */}
        <div
          style={{
            marginTop: '14px',
            padding: '12px 16px',
            background: effectiveDueAmount > 0 ? '#fffbeb' : '#ecfdf5',
            borderRadius: '6px',
            border: effectiveDueAmount > 0 ? '1px solid #fde68a' : '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '13px',
          }}
        >
          <div>
            <strong>Settlement Summary:</strong> Billed Total: <strong>৳{netGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> |
            Collected Upfront: <strong style={{ color: '#059669' }}>৳{effectivePaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            {settlementType !== 'credit' && ` via ${paymentMethod.toUpperCase()}`}
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: effectiveDueAmount > 0 ? '#b45309' : '#059669' }}>
            {effectiveDueAmount > 0 ? `Remaining Customer Due: ৳${effectiveDueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '✓ All Dues Cleared'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {validationHint && (
          <p className="muted" style={{ fontSize: '13px', margin: 0, color: '#d97706' }}>
            ℹ️ {validationHint}
          </p>
        )}
        <div className="button-row">
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
            onClick={() => void create()}
          >
            {busy ? 'Saving...' : `Save Sales Order (${netGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT)`}
          </button>
        </div>
      </div>
    </section>
  );
}
