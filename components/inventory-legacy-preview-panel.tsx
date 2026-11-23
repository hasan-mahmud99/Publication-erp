"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Gap = { item_id: string; warehouse_id: string; item_code: string; warehouse_code: string; tracking_policy: string; on_hand_qty: string; reserved_qty: string; average_unit_cost: string; ledger_qty: string; tagged_qty: string; gap_quantity: string; estimated_gap_value: string; classification: string };
type Preview = { total: number; estimatedTotalGapValue: string; limit: number; offset: number; rows: Gap[] };
export function InventoryLegacyPreviewPanel() {
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function load(offset: number) {
    setLoading(true); setError('');
    try { setPreview((await api<{ data: Preview }>(`/inventory/legacy-stock-preview?limit=100&offset=${offset}`)).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load legacy stock gaps'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(page * 100); }, [page]);
  return <section className="panel catalog-form"><h2 className="section-title">Legacy balance and movement gaps</h2>
    <p className="muted">Read-only dry run of current stock balances against posted movement quantities. A positive gap can indicate legacy balance-only stock; investigate the original cut-off, lot allocation, unit cost and existing GL opening balance before approving any migration. This report never changes stock or accounting.</p>
    {error && <p className="alert-error" role="alert">{error}</p>}
    <div className="button-row"><button className="btn" disabled={loading} onClick={() => void load(page * 100)}>Refresh gaps</button><span>{preview?.total ?? 0} gaps · estimated value {preview?.estimatedTotalGapValue ?? '0.00'} BDT</span></div>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Warehouse</th><th>Balance</th><th>Posted ledger</th><th>Gap</th><th>Avg cost</th><th>Estimated value</th><th>Tracking</th><th>Classification</th></tr></thead><tbody>{preview?.rows.length ? preview.rows.map(row => <tr key={`${row.item_id}:${row.warehouse_id}`}><td>{row.item_code}</td><td>{row.warehouse_code}</td><td>{row.on_hand_qty}</td><td>{row.ledger_qty}</td><td>{row.gap_quantity}</td><td>{row.average_unit_cost}</td><td>{row.estimated_gap_value}</td><td>{row.tracking_policy}{row.tracking_policy === 'lot' ? ` · ${row.tagged_qty} tagged` : ''}</td><td>{row.classification.replaceAll('_', ' ')}</td></tr>) : <tr><td colSpan={9} className="empty">No balance-to-ledger quantity gaps on this page.</td></tr>}</tbody></table></div>
    <div className="button-row"><button className="btn" disabled={loading || page === 0} onClick={() => setPage(current => current - 1)}>Previous gap page</button><span>Page {page + 1} of {Math.max(1, Math.ceil((preview?.total || 0) / 100))}</span><button className="btn" disabled={loading || (page + 1) * 100 >= (preview?.total || 0)} onClick={() => setPage(current => current + 1)}>Next gap page</button></div>
  </section>;
}
