"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Account = { id: string; account_code: string; name: string; account_type: string; is_active: number | boolean };
type Period = { id: string; code: string; start_date: string; end_date: string; status: string };
type CloseReadiness = { periodId: string; status: string; ready: boolean; blockers: Array<{ code: string; total: number }>; inventory: { ready: boolean; inventoryValue: string; glBalance: string; difference: string; missingCostLines: number; negativeWarehousePairs: number; foreignCurrencyLines: number; missingSourceJournals: number; currentLedgerMismatches: number; transferHistoryMismatches: number } };
type CloseSnapshot = { asOf: string; evidence: { inventoryValue: string; glBalance: string; difference: string }; sha256: string; signedBy: string; signedAt: string };
type Journal = { id: string; entry_number: string; posting_date: string; status: string; description: string; source_type?: string; source_id?: string };
type JournalLine = { id: string; account_code: string; account_name: string; debit: string; credit: string };
type JournalDetail = Journal & { lines: JournalLine[] };
type TrialRow = Account & { debit: number; credit: number };
type LedgerLine = { line_id: string; journal_id: string; entry_number: string; posting_date: string; description: string; account_code: string; account_name: string; debit: string; credit: string };
type DraftLine = { accountId: string; debit: string; credit: string; costCenterCode: string };
const displayDate = (value?: string | null) => value ? String(value).slice(0, 10) : '—';
const freshLines = (): DraftLine[] => [{ accountId: '', debit: '', credit: '', costCenterCode: '' }, { accountId: '', debit: '', credit: '', costCenterCode: '' }];
const journalLink = (id: string) => `/finance-accounting/journal-entry-detail?journal=${id}`;

export function FinanceScreen({ screen }: { screen: Screen }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [closeReadiness, setCloseReadiness] = useState<CloseReadiness | null>(null);
  const [closeSnapshot, setCloseSnapshot] = useState<CloseSnapshot | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalId, setJournalId] = useState('');
  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('asset');
  const [periodCode, setPeriodCode] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(freshLines);
  const [costCentres, setCostCentres] = useState<Array<{ code: string; name: string; status: string }>>([]);
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));
  const [reversalDescription, setReversalDescription] = useState('');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [ledgerAccount, setLedgerAccount] = useState('');
  const [ledger, setLedger] = useState<LedgerLine[]>([]);
  const [trial, setTrial] = useState<{ accounts: TrialRow[]; debit: number; credit: number; balanced: boolean } | null>(null);
  const [profit, setProfit] = useState<{ revenue: number; expense: number; netIncome: number } | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<{ assets: number; liabilities: number; equity: number; currentEarnings: number; balanced: boolean } | null>(null);
  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canPost = role === 'Owner' || permissions.includes('workspace.approve');

  async function loadBase() {
    const [accountResult, periodResult, journalResult, me] = await Promise.all([
      api<{ data: Account[] }>('/accounts/chart'),
      api<{ data: Period[] }>('/fiscal-periods'),
      api<{ data: Journal[] }>('/journal-entries?limit=100'),
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
    ]);
    setAccounts(accountResult.data);
    setPeriods(periodResult.data);
    setJournals(journalResult.data);
    setRole(me.data.role); setPermissions(me.data.permissions);
    setJournalId(current => current || journalResult.data[0]?.id || '');
  }
  async function loadReports() {
    const params = new URLSearchParams({ from, to });
    const [trialResult, profitResult, balanceResult] = await Promise.all([
      api<{ data: typeof trial }>(`/reports/trial-balance?${params}`),
      api<{ data: typeof profit }>(`/reports/profit-loss?${params}`),
      api<{ data: typeof balanceSheet }>(`/reports/balance-sheet?asOf=${to}`),
    ]);
    setTrial(trialResult.data);
    setProfit(profitResult.data);
    setBalanceSheet(balanceResult.data);
  }
  async function loadLedger() {
    const params = new URLSearchParams({ from, to, limit: '100' });
    if (ledgerAccount) params.set('accountId', ledgerAccount);
    const result = await api<{ data: LedgerLine[] }>(`/general-ledger?${params}`);
    setLedger(result.data);
  }
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('journal');
    if (wanted) setJournalId(wanted);
    void loadBase().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load finance data')).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!journalId) { setJournal(null); return; }
    void api<{ data: JournalDetail }>(`/journal-entries/${journalId}`).then(result => setJournal(result.data)).catch(() => setError('Could not load journal'));
  }, [journalId]);
  useEffect(() => { if (['Finance Dashboard', 'Trial Balance', 'Profit & Loss / Balance Sheet / Cash Flow'].includes(screen.title)) void loadReports().catch(() => setError('Could not load reports')); }, [screen.title]);
  useEffect(() => { if (screen.title === 'General Ledger') void loadLedger().catch(() => setError('Could not load general ledger')); }, [screen.title]);
  useEffect(() => { if (screen.title === 'Create Journal Voucher') void api<{ data: Array<{ code: string; name: string; status: string }> }>('/finance/cost-centers').then(result => setCostCentres(result.data)).catch(() => setCostCentres([])); }, [screen.title]);

  async function act(task: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function addAccount() {
    await act(async () => {
      await api('/accounts/chart', { method: 'POST', body: JSON.stringify({ code: accountCode.trim(), name: accountName.trim(), type: accountType }) });
      setAccountCode(''); setAccountName(''); await loadBase();
    }, 'Account created');
  }
  async function addPeriod() {
    await act(async () => {
      await api('/fiscal-periods', { method: 'POST', body: JSON.stringify({ code: periodCode.trim(), startDate: periodStart, endDate: periodEnd }) });
      setPeriodCode(''); setPeriodStart(''); setPeriodEnd(''); await loadBase();
    }, 'Fiscal period created');
  }
  async function closePeriod(id: string) {
    if (!window.confirm('Close this fiscal period? Ordinary posting will be blocked.')) return;
    await act(async () => { await api(`/fiscal-periods/${id}/close`, { method: 'POST' }); setCloseReadiness(null); await loadBase(); }, 'Fiscal period closed');
  }
  async function reviewCloseReadiness(id: string) {
    await act(async () => {
      const readiness = (await api<{ data: CloseReadiness }>(`/fiscal-periods/${id}/close-readiness`)).data;
      setCloseReadiness(readiness);
      if (readiness.status !== 'closed') { setCloseSnapshot(null); return; }
      try {
        setCloseSnapshot((await api<{ data: CloseSnapshot }>(`/fiscal-periods/${id}/inventory-snapshot`)).data);
      } catch (reason) {
        if (reason instanceof Error && reason.message === 'This period has no signed inventory close snapshot') setCloseSnapshot(null);
        else throw reason;
      }
    }, 'Period-close checks loaded');
  }
  async function createJournal() {
    await act(async () => {
      const result = await api<{ data: { id: string; entryNumber: string } }>('/journal-entries', { method: 'POST', body: JSON.stringify({ postingDate, description: description.trim(), lines: lines.map(line => ({ accountId: line.accountId, debit: line.debit || '0', credit: line.credit || '0', ...(line.costCenterCode ? { costCenterCode: line.costCenterCode } : {}) })) }) });
      setJournalId(result.data.id); setDescription(''); setLines(freshLines()); await loadBase();
    }, 'Draft journal created');
  }
  async function postJournal() {
    if (!journalId) return;
    if (!window.confirm('Post this journal? Posted lines become immutable.')) return;
    await act(async () => {
      await api(`/journal-entries/${journalId}/post`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } });
      await loadBase();
      const result = await api<{ data: JournalDetail }>(`/journal-entries/${journalId}`); setJournal(result.data);
    }, 'Journal posted');
  }
  async function reverseJournal() {
    if (!journalId) return;
    await act(async () => {
      const result = await api<{ data: { id: string } }>(`/journal-entries/${journalId}/reverse`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ postingDate: reversalDate, description: reversalDescription.trim() }) });
      setJournalId(result.data.id); setReversalDescription(''); await loadBase();
    }, 'Reversal posted');
  }
  function updateLine(index: number, field: keyof DraftLine, value: string) { setLines(current => current.map((line, position) => position === index ? { ...line, [field]: value } : line)); }

  const journalTable = (items: Journal[]) => <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Number</th><th>Date</th><th>Description</th><th>Status</th><th>Details</th></tr></thead><tbody>{items.length ? items.map(item => <tr key={item.id}><td>{item.entry_number}</td><td>{displayDate(item.posting_date)}</td><td>{item.description}</td><td>{item.status}</td><td><Link className="btn" href={journalLink(item.id)}>Open</Link></td></tr>) : <tr><td colSpan={5} className="empty">No journals found.</td></tr>}</tbody></table></div>;
  let content: React.ReactNode;
  switch (screen.title) {
    case 'Finance Dashboard':
      content = <><div className="stat-grid"><div className="panel stat"><div className="stat-label">Posted journals</div><div className="stat-value">{journals.filter(item => item.status === 'posted').length}</div></div><div className="panel stat"><div className="stat-label">Open periods</div><div className="stat-value">{periods.filter(item => item.status === 'open').length}</div></div><div className="panel stat"><div className="stat-label">Net income in selected range</div><div className="stat-value">{profit?.netIncome.toFixed(2) ?? '—'}</div></div><div className="panel stat"><div className="stat-label">Trial balance</div><div className="stat-value">{trial?.balanced ? 'Balanced' : 'Check'}</div></div></div><div className="button-row catalog-finance-links"><Link className="btn" href="/finance-accounting/chart-of-accounts">Chart of accounts</Link><Link className="btn" href="/finance-accounting/create-journal-voucher">New journal</Link><Link className="btn" href="/finance-accounting/trial-balance">Trial balance</Link></div>{journalTable(journals.slice(0, 10))}</>;
      break;
    case 'Chart of Accounts':
      content = <>{canCreate && <section className="panel catalog-form"><h2 className="section-title">Create account</h2><div className="catalog-form-grid"><label className="field">Code<input className="input" value={accountCode} onChange={event => setAccountCode(event.target.value)} /></label><label className="field">Name<input className="input" value={accountName} onChange={event => setAccountName(event.target.value)} /></label><label className="field">Type<select className="input" value={accountType} onChange={event => setAccountType(event.target.value)}>{['asset', 'liability', 'equity', 'revenue', 'expense'].map(type => <option key={type} value={type}>{type}</option>)}</select></label></div><button className="btn btn-primary" disabled={busy || !accountCode.trim() || !accountName.trim()} onClick={() => void addAccount()}>Create account</button></section>}<div className="panel table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Status</th></tr></thead><tbody>{accounts.map(item => <tr key={item.id}><td>{item.account_code}</td><td>{item.name}</td><td>{item.account_type}</td><td>{item.is_active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></div></>;
      break;
    case 'Journal Voucher List':
      content = <><p><Link className="btn btn-primary" href="/finance-accounting/create-journal-voucher">Create journal voucher</Link></p>{journalTable(journals)}</>;
      break;
    case 'Create Journal Voucher':
      content = <section className="panel catalog-form"><div className="catalog-form-grid"><label className="field">Posting date<input className="input" type="date" value={postingDate} onChange={event => setPostingDate(event.target.value)} /></label><label className="field">Description<input className="input" value={description} onChange={event => setDescription(event.target.value)} /></label></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Cost centre</th><th></th></tr></thead><tbody>{lines.map((line, index) => <tr key={index}><td><select className="input" aria-label={`Account for line ${index + 1}`} value={line.accountId} onChange={event => updateLine(index, 'accountId', event.target.value)}><option value="">Select account</option>{accounts.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.account_code} · {item.name}</option>)}</select></td><td><input className="input" type="number" min="0" step="0.01" aria-label={`Debit for line ${index + 1}`} value={line.debit} onChange={event => updateLine(index, 'debit', event.target.value)} /></td><td><input className="input" type="number" min="0" step="0.01" aria-label={`Credit for line ${index + 1}`} value={line.credit} onChange={event => updateLine(index, 'credit', event.target.value)} /></td><td><select className="input" aria-label={`Cost centre for line ${index + 1}`} value={line.costCenterCode} onChange={event => updateLine(index, 'costCenterCode', event.target.value)}><option value="">No cost centre</option>{costCentres.filter(item => item.status === 'active').map(item => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></td><td><button className="btn" disabled={lines.length <= 2} onClick={() => setLines(current => current.filter((_, position) => position !== index))}>Remove</button></td></tr>)}</tbody></table></div><div className="button-row"><button className="btn" onClick={() => setLines(current => [...current, { accountId: '', debit: '', credit: '', costCenterCode: '' }])}>Add line</button>{canCreate && <button className="btn btn-primary" disabled={busy || !description.trim() || lines.some(line => !line.accountId)} onClick={() => void createJournal()}>Create draft journal</button>}</div><p className="muted">Debits and credits must balance to the cent. Posting requires an open fiscal period.</p></section>;
      break;
    case 'Journal Entry Detail':
      content = <><label className="field">Journal<select className="input" value={journalId} onChange={event => setJournalId(event.target.value)}><option value="">Select journal</option>{journals.map(item => <option key={item.id} value={item.id}>{item.entry_number} · {item.description}</option>)}</select></label>{journal ? <><section className="panel catalog-form"><h2 className="section-title">{journal.entry_number}</h2><p>{journal.description} · {displayDate(journal.posting_date)} · {journal.status}</p>{journal.source_type && <p>Source: {journal.source_type} · {journal.source_id}</p>}</section><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{journal.lines.map(line => <tr key={line.id}><td>{line.account_code} · {line.account_name}</td><td>{line.debit}</td><td>{line.credit}</td></tr>)}</tbody></table></div>{canPost && journal.status === 'draft' && <button className="btn btn-primary" disabled={busy} onClick={() => void postJournal()}>Post journal</button>}{canPost && journal.status === 'posted' && journal.source_type !== 'journal_reversal' && <section className="panel catalog-form"><h2 className="section-title">Reverse posted journal</h2><div className="catalog-form-grid"><label className="field">Reversal date<input className="input" type="date" value={reversalDate} onChange={event => setReversalDate(event.target.value)} /></label><label className="field">Reason<input className="input" value={reversalDescription} onChange={event => setReversalDescription(event.target.value)} /></label></div><button className="btn" disabled={busy || !reversalDescription.trim()} onClick={() => void reverseJournal()}>Post reversal</button></section>}</> : <p className="empty">Select a journal.</p>}</>;
      break;
    case 'General Ledger':
      content = <><section className="panel catalog-form"><div className="catalog-form-grid"><label className="field">Account<select className="input" value={ledgerAccount} onChange={event => setLedgerAccount(event.target.value)}><option value="">All accounts</option>{accounts.map(item => <option key={item.id} value={item.id}>{item.account_code} · {item.name}</option>)}</select></label><label className="field">From<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field">To<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div><button className="btn btn-primary" onClick={() => void loadLedger().catch(reason => setError(reason instanceof Error ? reason.message : 'Report failed'))}>Run report</button></section><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Journal</th><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{ledger.length ? ledger.map(item => <tr key={item.line_id}><td>{displayDate(item.posting_date)}</td><td><Link href={journalLink(item.journal_id)}>{item.entry_number}</Link></td><td>{item.account_code} · {item.account_name}</td><td>{item.description}</td><td>{item.debit}</td><td>{item.credit}</td></tr>) : <tr><td colSpan={6} className="empty">No posted ledger lines in this range.</td></tr>}</tbody></table></div></>;
      break;
    case 'Trial Balance':
      content = <><section className="panel catalog-form"><div className="catalog-form-grid"><label className="field">From<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field">To<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div><button className="btn btn-primary" onClick={() => void loadReports().catch(reason => setError(reason instanceof Error ? reason.message : 'Report failed'))}>Run report</button><p className="muted">Basis: posted journals only.</p></section><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{trial?.accounts.map(item => <tr key={item.id}><td>{item.account_code} · {item.name}</td><td>{item.account_type}</td><td>{item.debit.toFixed(2)}</td><td>{item.credit.toFixed(2)}</td></tr>)}</tbody><tfoot><tr><th>Total</th><th>{trial?.balanced ? 'Balanced' : 'Unbalanced'}</th><th>{trial?.debit.toFixed(2)}</th><th>{trial?.credit.toFixed(2)}</th></tr></tfoot></table></div></>;
      break;
    case 'Profit & Loss / Balance Sheet / Cash Flow':
      content = <><section className="panel catalog-form"><div className="catalog-form-grid"><label className="field">From<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field">To / as of<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div><button className="btn btn-primary" onClick={() => void loadReports().catch(reason => setError(reason instanceof Error ? reason.message : 'Report failed'))}>Run reports</button><p className="muted">Basis: posted journals. Cash flow requires a separate approved account mapping and is not available yet.</p></section><div className="catalog-report-grid"><section className="panel catalog-form"><h2 className="section-title">Profit & loss</h2><p>Revenue: {profit?.revenue.toFixed(2) ?? '—'}</p><p>Expenses: {profit?.expense.toFixed(2) ?? '—'}</p><strong>Net income: {profit?.netIncome.toFixed(2) ?? '—'}</strong></section><section className="panel catalog-form"><h2 className="section-title">Balance sheet</h2><p>Assets: {balanceSheet?.assets.toFixed(2) ?? '—'}</p><p>Liabilities: {balanceSheet?.liabilities.toFixed(2) ?? '—'}</p><p>Equity: {balanceSheet?.equity.toFixed(2) ?? '—'}</p><p>Current earnings: {balanceSheet?.currentEarnings.toFixed(2) ?? '—'}</p><strong>{balanceSheet?.balanced ? 'Balances' : 'Review account mapping'}</strong></section></div></>;
      break;
    case 'Fiscal Period Close':
      content = <>
        {canPost && <section className="panel catalog-form"><h2 className="section-title">Create fiscal period</h2><div className="catalog-form-grid"><label className="field">Code<input className="input" value={periodCode} onChange={event => setPeriodCode(event.target.value)} /></label><label className="field">Start date<input className="input" type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} /></label><label className="field">End date<input className="input" type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || !periodCode.trim() || !periodStart || !periodEnd} onClick={() => void addPeriod()}>Create period</button></section>}
        <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Period</th><th>Start</th><th>End</th><th>Status</th><th>Action</th></tr></thead><tbody>{periods.map(item => <tr key={item.id}><td>{item.code}</td><td>{displayDate(item.start_date)}</td><td>{displayDate(item.end_date)}</td><td>{item.status}</td><td><div className="button-row"><button className="btn" disabled={busy} onClick={() => void reviewCloseReadiness(item.id)}>Review close checks</button>{canPost && item.status === 'open' && <button className="btn" disabled={busy || closeReadiness?.periodId !== item.id || !closeReadiness.ready} onClick={() => void closePeriod(item.id)}>Close</button>}</div></td></tr>)}</tbody></table></div>
        {closeReadiness && <section className="panel catalog-form"><h2 className="section-title">Inventory close checks</h2><p>{closeReadiness.status === 'closed' ? 'This period is closed. The stored snapshot below records its close evidence.' : closeReadiness.ready ? 'Inventory documents and valuation reconcile at this cut-off.' : 'Resolve these exceptions before closing the period.'}</p>{closeReadiness.blockers.map(row => <p key={row.code}>{row.code.replaceAll('_', ' ')}: {row.total}</p>)}<div className="stat-grid"><div className="panel stat"><div className="stat-label">Inventory value</div><div className="stat-value">{closeReadiness.inventory.inventoryValue}</div></div><div className="panel stat"><div className="stat-label">GL inventory control</div><div className="stat-value">{closeReadiness.inventory.glBalance}</div></div><div className="panel stat"><div className="stat-label">Difference</div><div className="stat-value">{closeReadiness.inventory.difference}</div></div></div>{!closeReadiness.inventory.ready && <p>Missing costs: {closeReadiness.inventory.missingCostLines} · Negative warehouse pairs: {closeReadiness.inventory.negativeWarehousePairs} · Foreign-currency lines: {closeReadiness.inventory.foreignCurrencyLines} · Missing source journals: {closeReadiness.inventory.missingSourceJournals} · Current ledger gaps: {closeReadiness.inventory.currentLedgerMismatches} · Transfer history gaps: {closeReadiness.inventory.transferHistoryMismatches}</p>}{closeSnapshot && <p>Stored inventory snapshot for {closeSnapshot.asOf}: {closeSnapshot.sha256} · signed by {closeSnapshot.signedBy.slice(0, 8)} at {String(closeSnapshot.signedAt).slice(0, 19)}</p>}{closeReadiness.status === 'closed' && !closeSnapshot && <p>This period was closed before inventory snapshots were introduced.</p>}</section>}
      </>;
      break;
    case 'Journal Reversal Register':
      content = journalTable(journals.filter(item => item.source_type === 'journal_reversal'));
      break;
    default:
      content = <p className="empty">Finance screen is being prepared.</p>;
  }
  return <><div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{screen.description}</p></div><button className="btn" onClick={() => void loadBase().catch(reason => setError(reason instanceof Error ? reason.message : 'Refresh failed'))}>Refresh</button></div>{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}{loading ? <div className="panel empty">Loading finance data…</div> : content}</>;
}
