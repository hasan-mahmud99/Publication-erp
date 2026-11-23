"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = { id: string; return_number: string; return_date: string; customer_name: string; invoice_number: string | null; status: string; requested_quantity: string; proposed_credit: string; received_quantity: string; receipt_status: string; financial_status: string };
type Detail = { id: string; return_number: string; invoice_number: string | null; lines: Array<{ id: string; book_title: string; quantity: number; net_refund_amount: string }> };
export function ReturnsFinancialHoldScreen({ screen }: { screen: Screen }) {
  const credit = screen.title === 'Sales Credit Note';
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; setLoading(true); void api<{ data: { rows: Row[]; total: number } }>(`/sales-sources/returns?status=posted&limit=25&offset=${page * 25}`).then(result => { if (active) { setRows(result.data.rows); setTotal(result.data.total); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load authorized returns'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [page]);
  async function view(id: string) { try { setError(''); setDetail((await api<{ data: Detail }>(`/sales-sources/returns/${id}`)).data); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load source detail'); } }
  return <>
    <div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{credit ? 'Review original invoice and proposed return amounts before any credit note can be issued.' : 'Track authorized returns and physical receipts before refund or replacement policy is configured.'}</p></div></div>
    <section className="panel catalog-form"><h2 className="section-title">Financial workflow on hold</h2><p>{credit ? 'The source Sales invoice has no posted AR, revenue or VAT journal to reverse. No credit note number or ledger entry is created here.' : 'No refund payment or replacement order is created here. Approval rules, payment mappings and replacement fulfilment controls require an approved returns policy.'}</p><p className="muted">Authorized return sources and proposed credit amounts below are evidence for review, not posted financial transactions.</p></section>
    {error && <p className="alert-error" role="alert">{error}</p>}
    <section className="panel catalog-form"><h2 className="section-title">{credit ? 'Authorized source review' : 'Return and receipt register'}</h2>{loading ? <p className="empty">Loading authorized returns...</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Return</th><th>Customer</th>{credit ? <><th>Original invoice</th><th>Requested copies</th><th>Proposed credit (BDT)</th><th>Credit note</th></> : <><th>Physical receipt</th><th>Received copies</th><th>Refund</th><th>Replacement</th></>}<th>Action</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{row.return_number}</td><td>{row.customer_name}</td>{credit ? <><td>{row.invoice_number || 'Unreferenced'}</td><td>{row.requested_quantity}</td><td>{row.proposed_credit}</td><td>Not issued</td></> : <><td>{row.receipt_status.replaceAll('_', ' ')}</td><td>{row.received_quantity}</td><td>Not posted</td><td>Not fulfilled</td></>}<td><button className="btn" onClick={() => void view(row.id)}>View source</button></td></tr>) : <tr><td colSpan={7} className="empty">No authorized returns on this page.</td></tr>}</tbody></table></div>}</section>
    <div className="pagination"><span>{total} authorized returns · page {page + 1}</span><div className="button-row"><button className="btn" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><button className="btn" disabled={(page + 1) * 25 >= total} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    {detail && <section className="panel catalog-form"><h2 className="section-title">Source {detail.return_number}</h2><p>Original invoice: {detail.invoice_number || 'Unreferenced'}</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Book</th><th>Returned copies</th><th>Proposed net amount (BDT)</th></tr></thead><tbody>{detail.lines.map(line => <tr key={line.id}><td>{line.book_title}</td><td>{line.quantity}</td><td>{line.net_refund_amount}</td></tr>)}</tbody></table></div><p className="muted">These source line amounts do not include a VAT adjustment or posted customer credit.</p></section>}
  </>;
}
