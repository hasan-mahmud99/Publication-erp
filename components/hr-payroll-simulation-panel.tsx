"use client";

import { useState } from 'react';
import { api } from '@/lib/api';

type Result = { id: string; demoOnly: true; policyApplied: false; financePosted: false; salaryPaid: false; basic: string; allowances: string; otherEarnings: string; gross: string; deductions: string; net: string; employerContributions: string; employerCost: string };
const fields = [
  ['basic', 'Monthly basic amount'], ['fixedAllowances', 'Fixed allowances'], ['variableAllowances', 'Variable allowances'], ['overtime', 'Manually supplied overtime amount'], ['bonus', 'Manually supplied bonus'], ['arrears', 'Arrears'], ['otherEarnings', 'Other earnings'],
  ['employeeDeductions', 'Other employee deductions'], ['taxWithholding', 'Manually supplied withholding'], ['advanceRecovery', 'Manually supplied advance recovery'], ['employerContributions', 'Employer contributions'],
] as const;
const defaults: Record<string, string> = Object.fromEntries(fields.map(([key]) => [key, '0']));

export function HrPayrollSimulationPanel() {
  const [form, setForm] = useState<Record<string, string>>({ ...defaults, eligibleDays: '1', divisorDays: '1', roundingMode: 'half_up' });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function change(key: string, value: string) { setForm(current => ({ ...current, [key]: value })); setResult(null); }
  async function calculate() {
    setBusy(true); setError(''); setResult(null);
    try { setResult((await api<{ data: Result }>('/hr/payroll-simulations', { method: 'POST', body: JSON.stringify(form) })).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Demo calculation failed'); }
    finally { setBusy(false); }
  }
  return <section className="panel catalog-form">
    <h2 className="section-title">Demo payroll calculation</h2>
    <p className="muted">Enter test amounts and an explicit rounding choice. These values are not read from employee records or legal policies. The result is not a payroll run, payslip, salary payment or Finance posting.</p>
    <div className="catalog-form-grid">{fields.map(([key, label]) => <label className="field" key={key}>{label} (BDT)<input className="input" type="number" min="0" step="0.01" value={form[key]} onChange={event => change(key, event.target.value)} /></label>)}
      <label className="field">Eligible days<input className="input" type="number" min="0" max="366" step="1" value={form.eligibleDays} onChange={event => change('eligibleDays', event.target.value)} /></label>
      <label className="field">Divisor days<input className="input" type="number" min="1" max="366" step="1" value={form.divisorDays} onChange={event => change('divisorDays', event.target.value)} /></label>
      <label className="field">Rounding mode<select className="input" value={form.roundingMode} onChange={event => change('roundingMode', event.target.value)}><option value="half_up">Half up</option><option value="half_even">Half even</option></select></label>
    </div><button className="btn btn-primary" disabled={busy} onClick={() => void calculate()}>Calculate demo</button>
    {error && <div className="alert-error" role="alert">{error}</div>}
    {result && <div className="panel catalog-form" role="status"><h3 className="section-title">Demo result · not approved payroll</h3><div className="stat-grid"><div className="stat"><span className="stat-label">Basic after selected proration</span><strong className="stat-value">{result.basic}</strong></div><div className="stat"><span className="stat-label">Gross</span><strong className="stat-value">{result.gross}</strong></div><div className="stat"><span className="stat-label">Employee deductions</span><strong className="stat-value">{result.deductions}</strong></div><div className="stat"><span className="stat-label">Net estimate</span><strong className="stat-value">{result.net}</strong></div><div className="stat"><span className="stat-label">Employer cost estimate</span><strong className="stat-value">{result.employerCost}</strong></div></div><p className="muted">Policy applied: no · Finance posted: no · Salary paid: no.</p></div>}
  </section>;
}
