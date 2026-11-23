"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Account = { id: string; account_code: string; name: string; account_type: string; debit: number; credit: number };
type Trial = { basis: { from: string; to: string; status: string }; accounts: Account[]; debit: number; credit: number; balanced: boolean };
type Profit = { accounts: Account[]; revenue: number; expense: number; netIncome: number };
type Balance = { accounts: Account[]; assets: number; liabilities: number; equity: number; currentEarnings: number; balanced: boolean };
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReportFinanceScreen() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`), [to, setTo] = useState(today());
  const [data, setData] = useState<{ trial: Trial; profit: Profit; balance: Balance } | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  async function run() {
    if (from > to) { setError('Start date must not exceed end date'); return; }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ from, to });
      const [trial, profit, balance] = await Promise.all([
        api<{ data: Trial }>(`/reports/trial-balance?${params}`),
        api<{ data: Profit }>(`/reports/profit-loss?${params}`),
        api<{ data: Balance }>(`/reports/balance-sheet?asOf=${to}`),
      ]);
      setData({ trial: trial.data, profit: profit.data, balance: balance.data });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Financial report failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void run(); }, []);
  return <>
    <div className="page-heading"><div><h1 className="page-title">Financial Statements</h1><p className="muted">Posted general ledger basis · BDT · organization scoped</p></div></div>
    <section className="panel catalog-form"><h2 className="section-title">Reporting period</h2><div className="catalog-form-grid"><label className="field">From<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field">To / as of<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div><button className="btn btn-primary" disabled={loading || !from || !to} onClick={() => void run()}>Run statements</button></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{loading && <div className="panel empty">Loading posted ledger…</div>}
    {data && !loading && <>
      <p className="muted">Profit & loss and trial balance: {data.trial.basis.from} to {data.trial.basis.to}. Balance sheet: as of {to}. Source status: {data.trial.basis.status}.</p>
      <div className="catalog-report-grid"><section className="panel catalog-form"><h2 className="section-title">Profit & loss</h2><p>Revenue: BDT {money(data.profit.revenue)}</p><p>Expenses: BDT {money(data.profit.expense)}</p><strong>Net income: BDT {money(data.profit.netIncome)}</strong></section><section className="panel catalog-form"><h2 className="section-title">Balance sheet</h2><p>Assets: BDT {money(data.balance.assets)}</p><p>Liabilities: BDT {money(data.balance.liabilities)}</p><p>Equity: BDT {money(data.balance.equity)}</p><p>Current earnings: BDT {money(data.balance.currentEarnings)}</p><strong>{data.balance.balanced ? 'Balanced' : 'Reconciliation required'}</strong></section></div>
      <section className="panel catalog-form"><h2 className="section-title">Trial balance</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Account</th><th>Type</th><th>Debit BDT</th><th>Credit BDT</th></tr></thead><tbody>{data.trial.accounts.length ? data.trial.accounts.map(row => <tr key={row.id}><td>{row.account_code} · {row.name}</td><td>{row.account_type}</td><td>{money(row.debit)}</td><td>{money(row.credit)}</td></tr>) : <tr><td colSpan={4}>No posted ledger lines for this period.</td></tr>}</tbody><tfoot><tr><th>Total</th><th>{data.trial.balanced ? 'Balanced' : 'Unbalanced'}</th><th>{money(data.trial.debit)}</th><th>{money(data.trial.credit)}</th></tr></tfoot></table></div></section>
      <p className="muted">Cash flow and audited statement export require approved cash account mapping and report export infrastructure. <Link href="/finance-accounting/general-ledger">Open posted general ledger</Link>.</p>
    </>}
  </>;
}
