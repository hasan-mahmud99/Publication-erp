"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Building2,
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  BookOpen,
  Mail,
  Phone,
  MapPin,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

export function SupplierLedgerScreen({ screen }: { screen: Screen }) {
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [profile, setProfile] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadProfile(id: string) {
    setSupplierId(id);
    setProfile(null);
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api<{ data: Row }>(`/procurement/supplier-profile/${id}`);
      setProfile(res.data);
    } catch (err: any) {
      setError(err?.message || 'Could not load supplier profile & ledger');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void api<{ data: { data: Row[] } }>('/procurement/suppliers?limit=100')
      .then(async res => {
        const list = res.data.data || [];
        setSuppliers(list);

        const urlSupplierId = new URLSearchParams(window.location.search).get('supplier');
        const targetId = urlSupplierId || (list.length ? list[0].id : '');
        if (targetId) {
          await loadProfile(targetId);
        } else {
          setLoading(false);
        }
      })
      .catch((err: any) => {
        setError(err?.message || 'Could not load suppliers');
        setLoading(false);
      });
  }, []);

  const kpis = useMemo(() => {
    if (!profile) return { grossBilled: 0, paid: 0, outstanding: 0, terms: 0 };
    const grossBilled = Number(profile.grossPostedAp || 0);
    const outstanding = Number(profile.netOutstanding || 0);
    const paid = Math.max(0, grossBilled - outstanding);
    const terms = Number(profile.supplier?.payment_terms_days || 0);
    return { grossBilled, paid, outstanding, terms };
  }, [profile]);

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Live supplier master identity, Accounts Payable ledger statement, bills, and payment allocations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {supplierId && (
            <>
              <button className="btn" onClick={() => void loadProfile(supplierId)} disabled={loading} title="Refresh">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh Ledger</span>
              </button>
              <button className="btn" onClick={() => window.print()} title="Print Statement">
                <FileText size={14} />
                <span>Print AP Statement</span>
              </button>
            </>
          )}
          <Link className="btn btn-primary" href="/suppliers/supplier-directory">
            <Building2 size={15} />
            <span>Supplier Directory</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Supplier Selector Bar */}
      <div
        className="panel"
        style={{
          padding: '14px 18px',
          marginBottom: 20,
          background: '#fff',
          borderRadius: 10,
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 320px' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
            Select Supplier:
          </label>
          <select
            className="input"
            value={supplierId}
            onChange={e => void loadProfile(e.target.value)}
            style={{ maxWidth: 380, height: 40 }}
          >
            <option value="">Choose Supplier</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.supplier_code} · {s.name}
              </option>
            ))}
          </select>
        </div>

        {profile?.supplier && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: profile.supplier.status === 'active' ? '#ecfdf5' : '#f1f5f9',
                color: profile.supplier.status === 'active' ? '#065f46' : '#64748b',
                textTransform: 'uppercase',
              }}
            >
              ● {profile.supplier.status}
            </span>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Terms: <strong>{profile.supplier.payment_terms_days ?? 0} days</strong> ({profile.supplier.currency_code || 'BDT'})
            </span>
          </div>
        )}
      </div>

      {/* 4 Financial KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #3b82f6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Gross Billed (AP)
            </span>
            <Receipt size={18} color="#3b82f6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.grossBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Total posted vendor invoices</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #10b981',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Paid &amp; Allocated
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Settled payments & advances</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #ef4444',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Net Payable Outstanding
            </span>
            <DollarSign size={18} color="#ef4444" />
          </div>
          <div
            className="stat-value"
            style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px', color: kpis.outstanding > 0 ? '#b91c1c' : '#0f172a' }}
          >
            BDT {kpis.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Current liability balance due</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #8b5cf6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Credit Terms
            </span>
            <Clock size={18} color="#8b5cf6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.terms} Days
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Currency: {profile?.supplier?.currency_code || 'BDT'}
          </span>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
          Loading supplier ledger...
        </div>
      )}

      {profile && (
        <>
          {/* Supplier Master Information Panel */}
          <div
            className="panel"
            style={{
              padding: '18px 22px',
              background: '#fff',
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {profile.supplier.name}
                </h2>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  Code: <code>{profile.supplier.supplier_code}</code> · Legal: <strong>{profile.supplier.legal_name || profile.supplier.name}</strong>
                  {profile.supplier.tax_registration && ` · Tax BIN: ${profile.supplier.tax_registration}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link
                  className="btn btn-sm btn-primary"
                  href={`/suppliers/supplier-advance-register`}
                >
                  + Request Advance
                </Link>
                <Link
                  className="btn btn-sm"
                  href={`/suppliers/supplier-bill-register`}
                >
                  Record Bill
                </Link>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid #f1f5f9',
                fontSize: 13,
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Categories</span>
                <span style={{ fontWeight: 600 }}>{(profile.supplier.categories || []).join(', ') || 'General'}</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Phone &amp; Email</span>
                <span style={{ fontWeight: 600 }}>
                  {profile.supplier.phone || 'No phone'} · {profile.supplier.email || 'No email'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Billing Address</span>
                <span>{profile.supplier.billing_address || profile.supplier.district || 'Dhaka, Bangladesh'}</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Key Contacts</span>
                <span>
                  {(profile.supplier.contacts || []).length
                    ? profile.supplier.contacts.map((c: Row) => c.contact_name).join(', ')
                    : 'No separate contacts'}
                </span>
              </div>
            </div>
          </div>

          {/* Accounts Payable (AP) Ledger Statement */}
          <div className="panel" style={{ padding: 20, background: '#fff', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                  Accounts Payable (AP) Running Ledger Statement
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Chronological record of invoices, advance payments, and debit notes.
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                Ending Balance: BDT {kpis.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Document Reference</th>
                    <th>Transaction Type</th>
                    <th style={{ textAlign: 'right' }}>Debit (Paid)</th>
                    <th style={{ textAlign: 'right' }}>Credit (Billed)</th>
                    <th style={{ textAlign: 'right' }}>Running AP Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(profile.ledger || []).length ? (
                    profile.ledger.map((entry: Row, idx: number) => (
                      <tr key={idx}>
                        <td>{String(entry.date).slice(0, 10)}</td>
                        <td>
                          <strong>{entry.reference}</strong>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: entry.type === 'Payment' ? '#eff6ff' : '#f8fafc',
                              color: entry.type === 'Payment' ? '#1d4ed8' : '#334155',
                              fontWeight: 600,
                            }}
                          >
                            {entry.type}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                          {Number(entry.debit) > 0 ? `BDT ${Number(entry.debit).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: '#b91c1c', fontWeight: 600 }}>
                          {Number(entry.credit) > 0 ? `BDT ${Number(entry.credit).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          BDT {Number(entry.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No Accounts Payable transactions recorded for this supplier.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Split Grid: Invoices & Payments */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {/* Supplier Bills & Invoices */}
            <div className="panel" style={{ padding: 20, background: '#fff', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                  Posted Supplier Bills
                </h3>
                <Link
                  href="/suppliers/supplier-bill-register"
                  style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}
                >
                  View All Bills →
                </Link>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bill # &amp; Date</th>
                      <th>Supplier Inv #</th>
                      <th>Base Amount</th>
                      <th>Outstanding</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.bills || []).length ? (
                      profile.bills.map((bill: Row) => (
                        <tr key={bill.id}>
                          <td>
                            <strong>{bill.bill_number}</strong>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {String(bill.invoice_date).slice(0, 10)}
                            </div>
                          </td>
                          <td>{bill.supplier_invoice_number}</td>
                          <td>BDT {Number(bill.base_amount).toLocaleString()}</td>
                          <td>
                            <strong style={{ color: Number(bill.outstanding_amount) > 0 ? '#b91c1c' : '#15803d' }}>
                              BDT {Number(bill.outstanding_amount || 0).toLocaleString()}
                            </strong>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: bill.status === 'posted' ? '#ecfdf5' : '#fffbeb',
                                color: bill.status === 'posted' ? '#065f46' : '#92400e',
                              }}
                            >
                              {bill.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                          No supplier bills on file.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments & Advances */}
            <div className="panel" style={{ padding: 20, background: '#fff', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                  Payments &amp; Advances
                </h3>
                <Link
                  href="/suppliers/supplier-advance-register"
                  style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}
                >
                  Manage Advances →
                </Link>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Payment #</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Allocated</th>
                      <th>Unapplied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.payments || []).length ? (
                      profile.payments.map((p: Row) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.payment_number}</strong>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {String(p.payment_date).slice(0, 10)}
                            </div>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{p.payment_type}</td>
                          <td>BDT {Number(p.amount).toLocaleString()}</td>
                          <td>BDT {Number(p.allocated_amount || 0).toLocaleString()}</td>
                          <td>
                            <strong style={{ color: Number(p.unapplied_amount) > 0 ? '#15803d' : '#64748b' }}>
                              BDT {Number(p.unapplied_amount || 0).toLocaleString()}
                            </strong>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                          No linked payments or advances.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
