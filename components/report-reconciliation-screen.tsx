"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Stock = { checked: number; reconciled: boolean; mismatches: Array<Record<string, any>> };
type GlStock = { checked: number; matched: number; exceptions: number; rows: Array<Record<string, any>>; limit: number };
type Trial = { basis: { from: string; to: string; status: string }; debit: number; credit: number; balanced: boolean };
export function ReportReconciliationScreen() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [stock, setStock] = useState<Stock | null>(null), [glStock, setGlStock] = useState<GlStock | null>(null), [trial, setTrial] = useState<Trial | null>(null);
  const [canFinance, setCanFinance] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const me = (await api<{ data: { role: string; permissions: string[] } }>('/auth/me')).data;
      const finance = me.role === 'Owner' || me.permissions.includes('finance.read'); setCanFinance(finance);
      const [stockResult, glResult, trialResult] = await Promise.all([
        api<{ data: Stock }>('/inventory/reconciliation'),
        finance ? api<{ data: GlStock }>('/inventory/gl-reconciliation') : Promise.resolve(null),
        finance ? api<{ data: Trial }>(`/reports/trial-balance?from=1000-01-01&to=${asOf}`) : Promise.resolve(null),
      ]);
      setStock(stockResult.data); setGlStock(glResult?.data || null); setTrial(trialResult?.data || null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Reconciliation check failed'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <>
    <div className="page-heading"><div><h1 className="page-title">Data Quality & Reconciliation Report</h1><p className="muted">Source checks with explicit coverage and access boundaries</p></div><button className="btn" onClick={() => void load()}>Refresh checks</button></div>
    <section className="panel catalog-form"><label className="field">Ledger cutoff date<input className="input" type="date" value={asOf} onChange={event => setAsOf(event.target.value)} /></label><button className="btn btn-primary" onClick={() => void load()}>Apply cutoff</button><p className="muted">The date applies to the trial balance only. Stock balance and inventory-to-GL checks use current or latest source records.</p></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{loading ? <div className="panel empty">Checking source records…</div> : <>
      <div className="catalog-report-grid"><section className="panel catalog-form"><h2 className="section-title">Stock balance versus movement ledger</h2><strong>{stock?.reconciled ? 'Matched' : 'Exceptions found'}</strong><p>{stock?.checked ?? 0} item and warehouse pairs checked · {stock?.mismatches.length ?? 0} exceptions</p><Link href="/inventory-warehouse/stock-reconciliation">Open stock reconciliation</Link></section>
      {canFinance && <><section className="panel catalog-form"><h2 className="section-title">Posted inventory movements versus GL</h2><strong>{glStock?.exceptions ? 'Exceptions found' : 'No exceptions in checked rows'}</strong><p>{glStock?.checked ?? 0} checked · {glStock?.matched ?? 0} matched · {glStock?.exceptions ?? 0} exceptions</p><p className="muted">At most {glStock?.limit ?? 500} movements checked.</p></section><section className="panel catalog-form"><h2 className="section-title">Posted trial balance</h2><strong>{trial?.balanced ? 'Balanced' : 'Unbalanced'}</strong><p>Debit BDT {Number(trial?.debit || 0).toFixed(2)} · Credit BDT {Number(trial?.credit || 0).toFixed(2)}</p><p>Posted ledger through {asOf}</p><Link href="/finance-accounting/trial-balance">Open trial balance</Link></section></>}</div>
      {!canFinance && <p className="muted">Finance read permission is required for GL and trial balance checks.</p>}
      {stock?.mismatches.length ? <section className="panel catalog-form"><h2 className="section-title">Stock exceptions</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Warehouse</th><th>On hand</th><th>Posted ledger</th><th>Reserved</th><th>Reservations</th></tr></thead><tbody>{stock.mismatches.slice(0, 100).map((row, index) => <tr key={index}><td>{String(row.item_id).slice(0, 8)}</td><td>{String(row.warehouse_id).slice(0, 8)}</td><td>{row.on_hand_qty}</td><td>{row.ledger_qty}</td><td>{row.reserved_qty}</td><td>{row.reservation_qty}</td></tr>)}</tbody></table></div></section> : null}
      <p className="muted">Sales-to-Finance, tax, royalty, payroll and cross-channel checks remain unavailable until their posting and source mappings are verified.</p>
    </>}
  </>;
}
