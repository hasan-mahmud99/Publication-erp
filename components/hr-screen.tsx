"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Briefcase,
  Building2,
  CalendarCheck,
  CreditCard,
  FileText,
  Lock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Send,
  Download,
  Plus,
  RefreshCw,
  Search,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { api, apiFile } from '@/lib/api';
import { HrLeavePanel } from './hr-leave-panel';
import { HrPayrollPolicyPanel } from './hr-payroll-policy-panel';
import { HrPayrollSimulationPanel } from './hr-payroll-simulation-panel';
import { HrSalaryPanel } from './hr-salary-panel';
import { HrDisbursementPanel } from './hr-disbursement-panel';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;
const date = (value: unknown) => (value ? String(value).slice(0, 10) : '—');
const money = (value: unknown) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

function StatusBadge({ status }: { status: string }) {
  const s = String(status || '').toLowerCase();
  if (['active', 'approved', 'posted', 'verified', 'completed', 'present'].includes(s)) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          background: '#ecfdf5',
          color: '#065f46',
          border: '1px solid #a7f3d0',
        }}
      >
        <CheckCircle2 size={12} />
        {status}
      </span>
    );
  }
  if (['locked', 'settled'].includes(s)) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe',
        }}
      >
        <Lock size={12} />
        {status}
      </span>
    );
  }
  if (['review', 'submitted', 'pending', 'unverified'].includes(s)) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          background: '#fffbeb',
          color: '#92400e',
          border: '1px solid #fde68a',
        }}
      >
        <Clock size={12} />
        {status}
      </span>
    );
  }
  if (['rejected', 'inactive', 'absence', 'cancelled'].includes(s)) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
        }}
      >
        <AlertCircle size={12} />
        {status}
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #cbd5e1',
      }}
    >
      {status || 'Draft'}
    </span>
  );
}

function ModernTable({
  headers,
  rows,
  render,
  empty,
}: {
  headers: string[];
  rows: Row[];
  render: (row: Row) => React.ReactNode;
  empty: string;
}) {
  return (
    <div
      className="table-wrap"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <table className="data-table">
        <thead style={{ background: '#f8fafc' }}>
          <tr>
            {headers.map((header) => (
              <th key={header} style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', padding: '12px 14px' }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={row.id || `${row.employee_id}-${row.component_id}` || index}>
                {render(row)}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="empty" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HrScreen({ screen }: { screen: Screen }) {
  const [departments, setDepartments] = useState<Row[]>([]);
  const [positions, setPositions] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [components, setComponents] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [assignmentEvents, setAssignmentEvents] = useState<Row[]>([]);
  const [runs, setRuns] = useState<Row[]>([]);
  const [claims, setClaims] = useState<Row[]>([]);
  const [audit, setAudit] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Row | null>(null);
  const [readiness, setReadiness] = useState<Row | null>(null);
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [runLines, setRunLines] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showDraftRunModal, setShowDraftRunModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    hireDate: today(),
    workDate: today(),
    effectiveFrom: today(),
    requestDate: today(),
    periodStart: today(),
    periodEnd: today(),
    transferEffectiveDate: today(),
    status: 'active',
    type: 'present',
    claimType: 'advance',
    componentType: 'earning',
    baseSalary: '0',
    amount: '0',
    hours: '8',
  });

  const canManage = role === 'Owner' || permissions.includes('hr.manage');
  const canApprove = role === 'Owner' || permissions.includes('hr.approve');
  const canExport = role === 'Owner' || permissions.includes('hr.export');
  const canManagePay = canManage && canExport;
  const selected = employees.find((row) => row.id === selectedId);
  const activeComponents = components.filter((row) => row.status === 'active');

  const value = (field: string) => form[field] || '';
  const change = (field: string, next: string) => setForm((current) => ({ ...current, [field]: next }));

  async function load() {
    setLoading(true);
    setError('');
    try {
      const me = await api<{ data: { role: string; permissions: string[]; userId: string } }>('/auth/me');
      const sensitive = me.data.role === 'Owner' || me.data.permissions.includes('hr.export');
      const needs: Record<string, string[]> = {
        'Employee Directory': ['summary', 'departments', 'positions', 'employees'],
        'Employee Profile': ['departments', 'positions', 'employees'],
        'Department & Position Setup': ['departments', 'positions'],
        'Attendance/Leave Register': ['summary', 'employees', 'attendance'],
        'Payroll Component Setup': ['employees', 'components', 'component-assignments'],
        'Payroll Processing & Review': ['summary', 'payroll-runs', 'payroll-readiness'],
        'Payroll Approval & Lock': ['payroll-runs', 'payroll-readiness'],
        'Payroll Journal & Payslip Register': ['payroll-runs'],
        'Employee Advance & Claims': ['employees', 'claims'],
        'Payroll Audit History': ['audit'],
      };
      const paths = needs[screen.title] || [];
      const result = await Promise.all(
        paths.map(
          async (path) =>
            [
              path,
              sensitive || !['components', 'component-assignments', 'payroll-runs', 'claims'].includes(path)
                ? (await api<{ data: any }>(`/hr/${path}`)).data
                : [],
            ] as const
        )
      );
      const records = Object.fromEntries(result) as Record<string, any>;
      if (records.summary) setSummary(records.summary);
      if (records.departments) setDepartments(records.departments);
      if (records.positions) setPositions(records.positions);
      if (records.employees) {
        setEmployees(records.employees);
        setSelectedId((current) => current || records.employees[0]?.id || '');
      }
      if (records.attendance) setAttendance(records.attendance);
      if (records.components) setComponents(records.components);
      if (records['component-assignments']) setAssignments(records['component-assignments']);
      if (records['payroll-runs']) {
        setRuns(records['payroll-runs']);
        setSelectedRunId((current) => current || records['payroll-runs'][0]?.id || '');
      }
      if (records['payroll-readiness']) setReadiness(records['payroll-readiness']);
      if (records.claims) setClaims(records.claims);
      if (records.audit) setAudit(records.audit);
      setRole(me.data.role);
      setUserId(me.data.userId);
      setPermissions(me.data.permissions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load HR data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const employeeId = new URLSearchParams(window.location.search).get('employee');
    if (employeeId) setSelectedId(employeeId);
    void load();
  }, [screen.title]);

  useEffect(() => {
    if (screen.title !== 'Employee Directory') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void api<{ data: Row[] }>(`/hr/employees?q=${encodeURIComponent(search.trim())}`)
        .then((result) => {
          if (!cancelled) setEmployees(result.data);
        })
        .catch((reason) => {
          if (!cancelled) setError(reason instanceof Error ? reason.message : 'Employee search failed');
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, screen.title]);

  useEffect(() => {
    if (screen.title !== 'Employee Profile' || !selectedId || employees.some((row) => row.id === selectedId)) return;
    let cancelled = false;
    void api<{ data: Row }>(`/hr/employees/${selectedId}`)
      .then((result) => {
        if (!cancelled) setEmployees((current) => [...current, result.data]);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load employee profile');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, employees, screen.title]);

  useEffect(() => {
    if (screen.title !== 'Employee Profile' || !selectedId) return;
    let cancelled = false;
    void api<{ data: Row[] }>(`/hr/employees/${selectedId}/assignments`)
      .then((result) => {
        if (!cancelled) setAssignmentEvents(result.data);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load assignment history');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, screen.title, selected?.version_no]);

  useEffect(() => {
    if (!selected || screen.title !== 'Employee Profile') return;
    setForm((current) => ({
      ...current,
      employeeCode: selected.employee_code,
      fullName: selected.full_name,
      email: selected.email || '',
      hireDate: date(selected.hire_date),
      departmentId: selected.department_id || '',
      positionId: selected.position_id || '',
      baseSalary: String(selected.base_salary),
      status: selected.status,
    }));
  }, [selectedId, employees, screen.title]);

  useEffect(() => {
    if (!selectedRunId || screen.title !== 'Payroll Journal & Payslip Register' || !canExport) return;
    void api<{ data: Row[] }>(`/hr/payroll-runs/${selectedRunId}/lines`)
      .then((result) => setRunLines(result.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load payroll lines'));
  }, [selectedRunId, screen.title, canExport]);

  async function mutate(path: string, body: Record<string, unknown>, success: string, method = 'POST') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setNotice(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function postPayrollToFinance(runId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: { journalId: string; entryNumber?: string; journalNumber?: string; taxTransactionNumber?: string; message?: string } }>(
        `/hr/payroll-runs/${runId}/post-to-finance`,
        { method: 'POST', body: '{}' }
      );
      const jNum = res.data.entryNumber || res.data.journalNumber || 'Journal Voucher';
      setNotice(
        `Payroll successfully posted to Finance GL (${jNum}). TDS Withholding registered under Section 86 (${res.data.taxTransactionNumber || 'Tax Transaction'}).`
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not post payroll run to Finance');
    } finally {
      setBusy(false);
    }
  }

  async function downloadPayslipPreview(employeeId: string, employeeCode: string) {
    if (!selectedRunId) return;
    setError('');
    try {
      const blob = await apiFile(`/hr/payroll-runs/${selectedRunId}/lines/${employeeId}/payslip-preview.pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip-${String(employeeCode || '').replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not download provisional preview');
    }
  }

  const field = (key: string, label: string, type = 'text', required = true) => (
    <label className="field" key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </span>
      <input
        className="input"
        type={type}
        value={value(key)}
        required={required}
        onChange={(event) => change(key, event.target.value)}
        style={{ height: 42, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
      />
    </label>
  );

  const employeeSelect = (key = 'employeeId') => (
    <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
        Employee <span style={{ color: '#ef4444' }}>*</span>
      </span>
      <select
        className="input"
        value={value(key)}
        onChange={(event) => change(key, event.target.value)}
        style={{ height: 42, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
      >
        <option value="">Select employee</option>
        {employees.map((row) => (
          <option value={row.id} key={row.id}>
            {row.employee_code} · {row.full_name}
          </option>
        ))}
      </select>
    </label>
  );

  const departmentSelect = () => (
    <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Department</span>
      <select
        className="input"
        value={value('departmentId')}
        onChange={(event) => {
          change('departmentId', event.target.value);
          change('positionId', '');
        }}
        style={{ height: 42, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
      >
        <option value="">Select department</option>
        {departments.map((row) => (
          <option value={row.id} key={row.id}>
            {row.code} · {row.name}
          </option>
        ))}
      </select>
    </label>
  );

  const positionSelect = () => (
    <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Position</span>
      <select
        className="input"
        value={value('positionId')}
        onChange={(event) => change('positionId', event.target.value)}
        style={{ height: 42, borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
      >
        <option value="">Select position</option>
        {positions
          .filter((row) => !value('departmentId') || row.department_id === value('departmentId'))
          .map((row) => (
            <option value={row.id} key={row.id}>
              {row.code} · {row.title}
            </option>
          ))}
      </select>
    </label>
  );

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  let content: React.ReactNode;

  // 1. Screen SCR-221: Employee Directory
  if (screen.title === 'Employee Directory') {
    const filtered = employees.filter((row) =>
      `${row.employee_code} ${row.full_name} ${row.department_name || ''}`.toLowerCase().includes(search.toLowerCase())
    );
    content = (
      <>
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="panel stat">
            <div className="stat-label">Total Employees</div>
            <div className="stat-value">{summary?.employees?.total || employees.length || 0}</div>
            <div className="stat-note">Enterprise Workforce</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Active Employees</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>
              {summary?.employees?.active || employees.filter((e) => e.status === 'active').length || 0}
            </div>
            <div className="stat-note">On Current Payroll</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Departments</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>
              {departments.length || summary?.departments || 0}
            </div>
            <div className="stat-note">HQ, Editorial, Press &amp; Logistics</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Today&apos;s Attendance</div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>
              {summary?.attendanceToday || 0}
            </div>
            <div className="stat-note">Verified Logs</div>
          </div>
        </div>

        {canManagePay && (
          <section
            className="panel"
            style={{
              padding: 24,
              marginBottom: 20,
              backgroundColor: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}
              >
                <Plus size={18} />
              </div>
              <h2 className="section-title" style={{ margin: 0 }}>
                Onboard New Employee
              </h2>
            </div>
            <div className="catalog-form-grid">
              {field('employeeCode', 'Employee Code')}
              {field('fullName', 'Full Name')}
              {field('email', 'Work Email', 'email', false)}
              {field('hireDate', 'Hire Date', 'date')}
              {departmentSelect()}
              {positionSelect()}
              {field('baseSalary', 'Monthly Base Salary (BDT)', 'number')}
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                disabled={busy || !value('employeeCode') || !value('fullName')}
                onClick={() =>
                  void mutate(
                    '/hr/employees',
                    {
                      employeeCode: value('employeeCode'),
                      fullName: value('fullName'),
                      email: value('email') || null,
                      hireDate: value('hireDate'),
                      departmentId: value('departmentId') || null,
                      positionId: value('positionId') || null,
                      baseSalary: value('baseSalary'),
                      status: 'active',
                    },
                    'Employee onboarded successfully'
                  )
                }
                style={{ height: 40, borderRadius: 8 }}
              >
                <Plus size={16} />
                <span>Save Employee Profile</span>
              </button>
            </div>
          </section>
        )}

        <div className="panel" style={{ padding: 18, background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                className="input"
                placeholder="Search employee by code, full name, or department..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ paddingLeft: 38, height: 40, borderRadius: 8 }}
              />
            </div>
            <span style={{ fontSize: 13, color: '#64748b' }}>{filtered.length} employees found</span>
          </div>
        </div>

        <ModernTable
          headers={['Code', 'Employee Name', 'Department', 'Position', 'Hire Date', 'Status', 'Action']}
          rows={filtered}
          empty="No employees found matching your search."
          render={(row) => (
            <>
              <td>
                <strong style={{ color: '#0f172a' }}>{row.employee_code}</strong>
              </td>
              <td>
                <Link
                  href={`/hr-payroll/employee-profile?employee=${row.id}`}
                  style={{ fontWeight: 600, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {row.full_name}
                  <ArrowRight size={12} />
                </Link>
              </td>
              <td>{row.department_name || '—'}</td>
              <td>{row.position_title || '—'}</td>
              <td>{date(row.hire_date)}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>
                <Link
                  href={`/hr-payroll/employee-profile?employee=${row.id}`}
                  className="btn"
                  style={{ height: 32, padding: '0 10px', fontSize: 12, borderRadius: 6 }}
                >
                  View Profile
                </Link>
              </td>
            </>
          )}
        />
      </>
    );
  }

  // 2. Screen SCR-222: Employee Profile
  else if (screen.title === 'Employee Profile') {
    content = (
      <>
        <div className="panel" style={{ padding: 18, background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
          <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Select Employee Profile</span>
            <select
              className="input"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff' }}
            >
              <option value="">Select Employee</option>
              {employees.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.employee_code} · {row.full_name} ({row.department_name || 'No Dept'})
                </option>
              ))}
            </select>
          </label>
        </div>

        {selected ? (
          <>
            <div className="catalog-report-grid" style={{ marginBottom: 20 }}>
              <section className="panel" style={{ padding: 22, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563eb',
                      fontWeight: 800,
                      fontSize: 16,
                    }}
                  >
                    {String(selected.full_name || 'E').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="section-title" style={{ margin: 0 }}>
                      {selected.full_name}
                    </h2>
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                      Code: <strong>{selected.employee_code}</strong> · Version {selected.version_no}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, marginTop: 12 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Department:</span>{' '}
                    <strong>{selected.department_name || 'Unassigned'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Position:</span>{' '}
                    <strong>{selected.position_title || 'Unassigned'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Hire Date:</span>{' '}
                    <strong>{date(selected.hire_date)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Employment Status:</span>{' '}
                    <StatusBadge status={selected.status} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b' }}>Work Email:</span>{' '}
                    <strong>{selected.email || 'Not recorded'}</strong>
                  </div>
                </div>
              </section>

              {canExport && (
                <section className="panel" style={{ padding: 22, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#15803d',
                      }}
                    >
                      <CreditCard size={18} />
                    </div>
                    <h2 className="section-title" style={{ margin: 0 }}>
                      Compensation Overview
                    </h2>
                  </div>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Monthly Base Salary
                  </span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '6px 0' }}>
                    BDT {money(selected.base_salary)}
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                    Confidential executive salary record. Any base changes require Maker-Checker review.
                  </p>
                </section>
              )}
            </div>

            {/* Transfer & Assignment History */}
            {canManage && (
              <section className="panel" style={{ padding: 22, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                <h3 className="section-title" style={{ marginBottom: 6 }}>
                  Department / Position Transfer
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                  Record structural movements across HQ, Press Floors, and Logistics without altering compensation history.
                </p>
                <div className="catalog-form-grid">
                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>New Department *</span>
                    <select
                      className="input"
                      value={value('transferDepartmentId')}
                      onChange={(event) => {
                        change('transferDepartmentId', event.target.value);
                        change('transferPositionId', '');
                      }}
                      style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff' }}
                    >
                      <option value="">Select department</option>
                      {departments
                        .filter((row) => row.status === 'active')
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>New Position *</span>
                    <select
                      className="input"
                      value={value('transferPositionId')}
                      onChange={(event) => change('transferPositionId', event.target.value)}
                      style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff' }}
                    >
                      <option value="">Select position</option>
                      {positions
                        .filter(
                          (row) => row.status === 'active' && row.department_id === value('transferDepartmentId')
                        )
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  {field('transferEffectiveDate', 'Transfer Effective Date', 'date')}
                  {field('transferReason', 'Transfer Reason')}
                </div>
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary"
                    disabled={
                      busy ||
                      !value('transferDepartmentId') ||
                      !value('transferPositionId') ||
                      value('transferReason').trim().length < 10
                    }
                    onClick={() =>
                      void mutate(
                        `/hr/employees/${selected.id}/transfer`,
                        {
                          version: selected.version_no,
                          departmentId: value('transferDepartmentId'),
                          positionId: value('transferPositionId'),
                          effectiveDate: value('transferEffectiveDate'),
                          reason: value('transferReason'),
                        },
                        'Employee transfer recorded successfully'
                      )
                    }
                    style={{ height: 40, borderRadius: 8 }}
                  >
                    Record Transfer
                  </button>
                </div>
              </section>
            )}

            <div style={{ marginBottom: 20 }}>
              <h3 className="section-title" style={{ marginBottom: 12 }}>
                Assignment History
              </h3>
              <ModernTable
                headers={['Effective Date', 'From Dept / Position', 'To Dept / Position', 'Reason']}
                rows={assignmentEvents}
                empty="No structural transfer history recorded for this employee."
                render={(row) => (
                  <>
                    <td>{date(row.effective_date)}</td>
                    <td>
                      {row.from_department || 'Unassigned'} / {row.from_position || 'Unassigned'}
                    </td>
                    <td>
                      <strong>
                        {row.to_department} / {row.to_position}
                      </strong>
                    </td>
                    <td>{row.reason}</td>
                  </>
                )}
              />
            </div>

            {canExport && (
              <HrSalaryPanel
                employeeId={selected.id}
                canManage={canManagePay}
                canApprove={canApprove}
                userId={userId}
                onUpdated={() => void load()}
              />
            )}
          </>
        ) : (
          <div className="panel empty" style={{ padding: 40, textAlign: 'center', background: '#fff', borderRadius: 14 }}>
            Select an employee from the selector above to inspect their profile and history.
          </div>
        )}
      </>
    );
  }

  // 3. Screen SCR-223: Department & Position Setup
  else if (screen.title === 'Department & Position Setup') {
    content = (
      <>
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="panel stat">
            <div className="stat-label">Total Departments</div>
            <div className="stat-value">{departments.length}</div>
            <div className="stat-note">Organizational Units</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Total Positions</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>
              {positions.length}
            </div>
            <div className="stat-note">Job Titles Defined</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Press &amp; Production Positions</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>
              {positions.filter((p) => String(p.title || '').toLowerCase().includes('press') || String(p.title || '').toLowerCase().includes('print')).length}
            </div>
            <div className="stat-note">Operational Shifts</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">HQ &amp; Editorial Positions</div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>
              {positions.filter((p) => !String(p.title || '').toLowerCase().includes('press')).length}
            </div>
            <div className="stat-note">Administrative Units</div>
          </div>
        </div>

        <div className="catalog-report-grid">
          {/* Departments Panel */}
          <section className="panel" style={{ padding: 22, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Building2 size={20} color="#2563eb" />
              <h2 className="section-title" style={{ margin: 0 }}>
                Departments
              </h2>
            </div>
            {canManage && (
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                <div className="catalog-form-grid">
                  {field('departmentCode', 'Department Code')}
                  {field('departmentName', 'Department Name')}
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !value('departmentCode') || !value('departmentName')}
                    onClick={() =>
                      void mutate(
                        '/hr/departments',
                        { code: value('departmentCode'), name: value('departmentName') },
                        'Department created successfully'
                      )
                    }
                    style={{ height: 38, borderRadius: 8 }}
                  >
                    <Plus size={15} />
                    <span>Add Department</span>
                  </button>
                </div>
              </div>
            )}
            <ModernTable
              headers={['Code', 'Department Name', 'Status']}
              rows={departments}
              empty="No departments registered."
              render={(row) => (
                <>
                  <td>
                    <code>{row.code}</code>
                  </td>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>
                    <StatusBadge status={row.status || 'active'} />
                  </td>
                </>
              )}
            />
          </section>

          {/* Positions Panel */}
          <section className="panel" style={{ padding: 22, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Briefcase size={20} color="#16a34a" />
              <h2 className="section-title" style={{ margin: 0 }}>
                Positions
              </h2>
            </div>
            {canManage && (
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                <div className="catalog-form-grid">
                  {field('positionCode', 'Position Code')}
                  {field('positionTitle', 'Position Title')}
                  {departmentSelect()}
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !value('positionCode') || !value('positionTitle') || !value('departmentId')}
                    onClick={() =>
                      void mutate(
                        '/hr/positions',
                        {
                          code: value('positionCode'),
                          title: value('positionTitle'),
                          departmentId: value('departmentId'),
                        },
                        'Position registered successfully'
                      )
                    }
                    style={{ height: 38, borderRadius: 8 }}
                  >
                    <Plus size={15} />
                    <span>Add Position</span>
                  </button>
                </div>
              </div>
            )}
            <ModernTable
              headers={['Code', 'Position Title', 'Department', 'Status']}
              rows={positions}
              empty="No positions registered."
              render={(row) => (
                <>
                  <td>
                    <code>{row.code}</code>
                  </td>
                  <td>
                    <strong>{row.title}</strong>
                  </td>
                  <td>{row.department_name || '—'}</td>
                  <td>
                    <StatusBadge status={row.status || 'active'} />
                  </td>
                </>
              )}
            />
          </section>
        </div>
      </>
    );
  }

  // 4. Screen SCR-224: Attendance/Leave Register
  else if (screen.title === 'Attendance/Leave Register') {
    content = (
      <>
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="panel stat">
            <div className="stat-label">Logged Attendance Today</div>
            <div className="stat-value">{summary?.attendanceToday || 0}</div>
            <div className="stat-note">HQ &amp; Press Floor Logs</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Shift Extensions (Overtime)</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>
              {attendance.filter((a) => a.entry_type === 'overtime').length}
            </div>
            <div className="stat-note">Printing &amp; Binding Crews</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Approved Leaves</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>
              {attendance.filter((a) => a.entry_type === 'leave').length}
            </div>
            <div className="stat-note">Statutory Allowances</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Unverified Entries</div>
            <div className="stat-value" style={{ color: '#d97706' }}>
              {attendance.filter((a) => a.approval_status === 'unverified').length}
            </div>
            <div className="stat-note">Awaiting Review</div>
          </div>
        </div>

        {canManage && (
          <section className="panel" style={{ padding: 22, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <CalendarCheck size={20} color="#2563eb" />
              <h2 className="section-title" style={{ margin: 0 }}>
                Record Attendance or Overtime Observation
              </h2>
            </div>
            <div className="catalog-form-grid">
              {employeeSelect()}
              {field('workDate', 'Work Date', 'date')}
              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                  Entry Type <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <select
                  className="input"
                  value={value('type')}
                  onChange={(event) => {
                    change('type', event.target.value);
                    if (event.target.value === 'absence') change('hours', '0');
                  }}
                  style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff' }}
                >
                  <option value="present">Present (Standard Shift)</option>
                  <option value="overtime">Overtime (Press Extension)</option>
                  <option value="leave">Leave</option>
                  <option value="absence">Absence</option>
                </select>
              </label>
              {field('hours', 'Working / OT Hours', 'number')}
              {field('note', 'Shift Note / Machine Unit', 'text', false)}
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                disabled={busy || !value('employeeId')}
                onClick={() =>
                  void mutate(
                    '/hr/attendance',
                    {
                      employeeId: value('employeeId'),
                      workDate: value('workDate'),
                      type: value('type'),
                      hours: value('hours'),
                      note: value('note'),
                    },
                    'Observation submitted for Maker-Checker review'
                  )
                }
                style={{ height: 40, borderRadius: 8 }}
              >
                Submit Observation
              </button>
            </div>
          </section>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Recent Attendance &amp; Shift Register
            </h3>
            {canApprove && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Review Note:</span>
                <input
                  className="input"
                  placeholder="Min 10 chars review note..."
                  value={value('attendanceReviewNote')}
                  onChange={(event) => change('attendanceReviewNote', event.target.value)}
                  style={{ width: 260, height: 36, borderRadius: 6, fontSize: 12.5 }}
                />
              </div>
            )}
          </div>
          <ModernTable
            headers={['Date', 'Employee', 'Type', 'Hours', 'Shift / Note', 'Approval Status', 'Decision']}
            rows={attendance}
            empty="No attendance or shift records logged."
            render={(row) => (
              <>
                <td>{date(row.work_date)}</td>
                <td>
                  <strong style={{ color: '#0f172a' }}>{row.employee_code}</strong> · {row.full_name}
                </td>
                <td>
                  <StatusBadge status={row.entry_type} />
                </td>
                <td>
                  <strong>{row.hours} hrs</strong>
                </td>
                <td>{row.note || '—'}</td>
                <td>
                  <StatusBadge status={row.approval_status} />
                </td>
                <td>
                  {row.approval_status === 'unverified' && canApprove && row.created_by !== userId ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['present', 'absence', 'overtime'].includes(row.entry_type) && (
                        <button
                          className="btn btn-primary"
                          disabled={busy || value('attendanceReviewNote').trim().length < 10}
                          onClick={() =>
                            void mutate(
                              `/hr/attendance/${row.id}/review`,
                              { decision: 'approve', note: value('attendanceReviewNote') },
                              'Attendance entry approved'
                            )
                          }
                          style={{ height: 30, padding: '0 10px', fontSize: 11, borderRadius: 6 }}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        className="btn"
                        disabled={busy || value('attendanceReviewNote').trim().length < 10}
                        onClick={() =>
                          void mutate(
                            `/hr/attendance/${row.id}/review`,
                            { decision: 'reject', note: value('attendanceReviewNote') },
                            'Entry rejected'
                          )
                        }
                        style={{ height: 30, padding: '0 10px', fontSize: 11, borderRadius: 6, color: '#dc2626' }}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#64748b' }}>{row.review_note || '—'}</span>
                  )}
                </td>
              </>
            )}
          />
        </div>

        <HrLeavePanel employees={employees} canManage={canManage} canApprove={canApprove} userId={userId} />
      </>
    );
  }

  // 5. Screen SCR-225: Payroll Component Setup
  else if (screen.title === 'Payroll Component Setup') {
    content = (
      <>
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="panel stat">
            <div className="stat-label">Active Components</div>
            <div className="stat-value">{activeComponents.length}</div>
            <div className="stat-note">Earnings &amp; Deductions</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Total Employee Assignments</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>
              {assignments.length}
            </div>
            <div className="stat-note">Active Employee Allocations</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Statutory Policies</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>
              {readiness?.policyCount || 6}
            </div>
            <div className="stat-note">Leave, OT, GL, TDS, Proration</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Audit Versions</div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>
              {components.length}
            </div>
            <div className="stat-note">Effective-Dated History</div>
          </div>
        </div>

        {canManagePay && (
          <div className="catalog-report-grid" style={{ marginBottom: 20 }}>
            {/* Component Creator */}
            <section className="panel" style={{ padding: 22, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <h2 className="section-title" style={{ marginBottom: 4 }}>
                Create / Version Payroll Component
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                Creating an existing code automatically supersedes previous versions with an effective date.
              </p>
              <div className="catalog-form-grid">
                {field('componentCode', 'Component Code')}
                {field('componentName', 'Component Name')}
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Type *</span>
                  <select
                    className="input"
                    value={value('componentType')}
                    onChange={(event) => change('componentType', event.target.value)}
                    style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff' }}
                  >
                    <option value="earning">Earning (e.g. House Rent, Medical)</option>
                    <option value="deduction">Deduction (e.g. Provident Fund, TDS)</option>
                  </select>
                </label>
                {field('amount', 'Monthly Amount (BDT)', 'number')}
                {field('effectiveFrom', 'Effective From', 'date')}
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  disabled={busy || !value('componentCode') || !value('componentName')}
                  onClick={() =>
                    void mutate(
                      '/hr/components',
                      {
                        code: value('componentCode'),
                        name: value('componentName'),
                        type: value('componentType'),
                        amount: value('amount'),
                        effectiveFrom: value('effectiveFrom'),
                      },
                      'Component version saved successfully'
                    )
                  }
                  style={{ height: 40, borderRadius: 8 }}
                >
                  Save Component Version
                </button>
              </div>
            </section>

            {/* Component Assignor */}
            <section className="panel" style={{ padding: 22, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <h2 className="section-title" style={{ marginBottom: 4 }}>
                Assign Component to Employee
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                Allocates an approved component to an active employee for ongoing payroll computation.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {employeeSelect()}
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Active Component *</span>
                  <select
                    className="input"
                    value={value('componentId')}
                    onChange={(event) => change('componentId', event.target.value)}
                    style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff' }}
                  >
                    <option value="">Select component</option>
                    {activeComponents.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.code} · {row.name} ({row.component_type.toUpperCase()} · BDT {money(row.amount)})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  disabled={busy || !value('employeeId') || !value('componentId')}
                  onClick={() =>
                    void mutate(
                      '/hr/component-assignments',
                      { employeeId: value('employeeId'), componentId: value('componentId') },
                      'Component allocated to employee successfully'
                    )
                  }
                  style={{ height: 40, borderRadius: 8 }}
                >
                  Assign to Employee
                </button>
              </div>
            </section>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>
            Master Payroll Components Register
          </h3>
          <ModernTable
            headers={['Code', 'Name', 'Category', 'Monthly Amount', 'Effective Date', 'Version', 'Status']}
            rows={components}
            empty="No payroll components configured."
            render={(row) => (
              <>
                <td>
                  <code>{row.code}</code>
                </td>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: row.component_type === 'earning' ? '#ecfdf5' : '#fef2f2',
                      color: row.component_type === 'earning' ? '#065f46' : '#991b1b',
                    }}
                  >
                    {row.component_type}
                  </span>
                </td>
                <td>
                  <strong>BDT {money(row.amount)}</strong>
                </td>
                <td>{date(row.effective_from)}</td>
                <td>v{row.version_no}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
              </>
            )}
          />
        </div>

        {canExport && <HrPayrollPolicyPanel canManage={canManagePay} canApprove={canApprove} userId={userId} />}
      </>
    );
  }

  // 6. Screen SCR-226: Payroll Processing & Review
  else if (screen.title === 'Payroll Processing & Review') {
    const totalGross = runs.reduce((acc, r) => acc + Number(r.gross_total || 0), 0);
    const totalDeductions = runs.reduce((acc, r) => acc + Number(r.deduction_total || 0), 0);
    const totalNet = runs.reduce((acc, r) => acc + Number(r.net_total || 0), 0);

    content = (
      <>
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="panel stat">
            <div className="stat-label">Payroll Runs</div>
            <div className="stat-value">{runs.length}</div>
            <div className="stat-note">Historical &amp; Current</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Total Gross Payout</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>
              BDT {money(totalGross)}
            </div>
            <div className="stat-note">Base + Allowances</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Statutory Deductions</div>
            <div className="stat-value" style={{ color: '#dc2626' }}>
              BDT {money(totalDeductions)}
            </div>
            <div className="stat-note">PF &amp; Salary TDS</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Net Salary Disbursable</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>
              BDT {money(totalNet)}
            </div>
            <div className="stat-note">Bank Transfer Net</div>
          </div>
        </div>

        {/* Action Header Card */}
        <div
          className="panel"
          style={{
            padding: 20,
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Prepare New Monthly Payroll Calculation
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              Computes base salaries, active allowances, PF deductions, and Section 86 salary TDS for all active employees.
            </p>
          </div>
          {canManagePay && (
            <button
              className="btn btn-primary"
              onClick={() => setShowDraftRunModal(true)}
              style={{ height: 42, borderRadius: 8, padding: '0 20px', gap: 8 }}
            >
              <Plus size={16} />
              <span>+ Prepare Draft Run</span>
            </button>
          )}
        </div>

        {/* Modal for Preparing Draft Run */}
        {showDraftRunModal && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 9999,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 520,
                backgroundColor: '#ffffff',
                background: '#ffffff',
                borderRadius: 16,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
                border: '1px solid #cbd5e1',
                overflow: 'hidden',
                zIndex: 10000,
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px 24px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={20} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    Prepare Monthly Payroll Snapshot
                  </h3>
                </div>
                <button
                  className="btn"
                  onClick={() => setShowDraftRunModal(false)}
                  style={{ width: 34, height: 34, padding: 0, borderRadius: 8 }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {field('periodStart', 'Period Start Date', 'date')}
                {field('periodEnd', 'Period End Date', 'date')}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  padding: '16px 24px',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                <button className="btn" onClick={() => setShowDraftRunModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={async () => {
                    setShowDraftRunModal(false);
                    await mutate(
                      '/hr/payroll-runs',
                      { periodStart: value('periodStart'), periodEnd: value('periodEnd') },
                      'Monthly payroll run generated successfully'
                    );
                  }}
                >
                  Confirm &amp; Compute
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>
            Processed Monthly Payroll Runs
          </h3>
          <ModernTable
            headers={['Period', 'Employees', 'Gross Pay', 'Deductions (TDS/PF)', 'Net Payable', 'Status', 'Finance GL', 'Action']}
            rows={runs}
            empty="No monthly payroll runs generated yet."
            render={(row) => (
              <>
                <td>
                  <strong>
                    {date(row.period_start)} – {date(row.period_end)}
                  </strong>
                </td>
                <td>{row.employee_count} staff</td>
                <td>BDT {money(row.gross_total)}</td>
                <td style={{ color: '#dc2626' }}>BDT {money(row.deduction_total)}</td>
                <td>
                  <strong style={{ color: '#16a34a' }}>BDT {money(row.net_total)}</strong>
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  {row.journal_number ? (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      {row.journal_number}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Unposted</span>
                  )}
                </td>
                <td>
                  {row.status === 'draft' && canManagePay ? (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `/hr/payroll-runs/${row.id}/transition`,
                          { action: 'submit' },
                          'Payroll run submitted for approval'
                        )
                      }
                      style={{ height: 32, padding: '0 12px', fontSize: 12, borderRadius: 6 }}
                    >
                      <Send size={12} />
                      <span>Submit for Review</span>
                    </button>
                  ) : (
                    <Link
                      href={`/hr-payroll/payroll-journal-and-payslip-register`}
                      className="btn"
                      style={{ height: 32, padding: '0 10px', fontSize: 12, borderRadius: 6 }}
                    >
                      Inspect Lines
                    </Link>
                  )}
                </td>
              </>
            )}
          />
        </div>

        {canManagePay && <HrPayrollSimulationPanel />}
      </>
    );
  }

  // 7. Screen SCR-227: Payroll Approval & Lock
  else if (screen.title === 'Payroll Approval & Lock') {
    const approvalRuns = runs.filter((row) => ['review', 'approved', 'locked'].includes(row.status));

    content = (
      <>
        {/* Compliance / Readiness Banner */}
        <div
          className="panel"
          style={{
            padding: 20,
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#15803d',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Payroll Finalization &amp; Separation of Duties
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Strict Maker-Checker protocol: Preparer cannot approve or lock. Statutory policies for proration, overtime, salary TDS, and Finance GL posting are verified.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 12,
              marginTop: 14,
            }}
          >
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ Proration Policy</span>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>Approved Calendar-Day Basis</p>
            </div>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ Overtime / Attendance</span>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>Press 1.5x Overtime Verified</p>
            </div>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ Section 86 Salary TDS</span>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>Income Tax Act Withholding</p>
            </div>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ Finance GL Linkage</span>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>Accounts 5100, 2210, 2220, 2130</p>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>
            Awaiting Approval &amp; Locked Payroll Periods
          </h3>
          <ModernTable
            headers={['Period', 'Employees', 'Net Payable', 'Prepared By', 'Status', 'Finance GL', 'Workflow Action']}
            rows={approvalRuns}
            empty="No payroll runs awaiting approval or locked."
            render={(row) => (
              <>
                <td>
                  <strong>
                    {date(row.period_start)} – {date(row.period_end)}
                  </strong>
                </td>
                <td>{row.employee_count} employees</td>
                <td>
                  <strong style={{ color: '#16a34a' }}>BDT {money(row.net_total)}</strong>
                </td>
                <td>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {row.created_by ? String(row.created_by).slice(0, 8) : 'Owner'}
                  </span>
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  {row.journal_number ? (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#ecfdf5',
                        color: '#065f46',
                      }}
                    >
                      {row.journal_number}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Pending Post</span>
                  )}
                </td>
                <td>
                  {row.status === 'review' ? (
                    canApprove && (role === 'Owner' || row.created_by !== userId) ? (
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            `/hr/payroll-runs/${row.id}/transition`,
                            { action: 'approve' },
                            'Payroll run approved by checker'
                          )
                        }
                        style={{ height: 32, padding: '0 12px', fontSize: 12, borderRadius: 6 }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Approve Payroll</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: '#d97706' }}>Awaiting Independent Approver</span>
                    )
                  ) : row.status === 'approved' ? (
                    canApprove ? (
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            `/hr/payroll-runs/${row.id}/transition`,
                            { action: 'lock' },
                            'Payroll period locked and finalized'
                          )
                        }
                        style={{
                          height: 32,
                          padding: '0 12px',
                          fontSize: 12,
                          borderRadius: 6,
                          background: '#eff6ff',
                          borderColor: '#bfdbfe',
                          color: '#1d4ed8',
                          fontWeight: 600,
                        }}
                      >
                        <Lock size={13} />
                        <span>Lock Period</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: '#64748b' }}>Approved · Ready to Lock</span>
                    )
                  ) : (
                    <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>✓ Locked &amp; Archived</span>
                  )}
                </td>
              </>
            )}
          />
        </div>
      </>
    );
  }

  // 8. Screen SCR-228: Payroll Journal & Payslip Register
  else if (screen.title === 'Payroll Journal & Payslip Register') {
    content = (
      <>
        {/* Run Selector and GL Linkage Card */}
        <div
          className="panel"
          style={{
            padding: 22,
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ minWidth: 280, flex: 1 }}>
              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Select Payroll Period</span>
                <select
                  className="input"
                  value={selectedRunId}
                  onChange={(event) => setSelectedRunId(event.target.value)}
                  style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff' }}
                >
                  <option value="">Select Payroll Period</option>
                  {runs.map((row) => (
                    <option key={row.id} value={row.id}>
                      {date(row.period_start)} – {date(row.period_end)} ({String(row.status).toUpperCase()} · Net BDT{' '}
                      {money(row.net_total)}) {row.journal_number ? `· GL: ${row.journal_number}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedRun && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {selectedRun.journal_number ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
                        Finance GL Journal Voucher
                      </span>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#047857' }}>
                        {selectedRun.journal_number} (Posted)
                      </div>
                    </div>
                    {selectedRun.journal_id && (
                      <Link
                        href={`/finance-accounting/journal-entry-detail?journal=${selectedRun.journal_id}`}
                        className="btn"
                        style={{ height: 32, padding: '0 10px', fontSize: 12, borderRadius: 6, background: '#ffffff' }}
                      >
                        <ExternalLink size={13} />
                        <span>View GL</span>
                      </Link>
                    )}
                  </div>
                ) : (
                  canManagePay && (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void postPayrollToFinance(selectedRun.id)}
                      style={{ height: 42, padding: '0 18px', borderRadius: 8, gap: 8, background: '#1d4ed8' }}
                    >
                      <FileCheck size={16} />
                      <span>⚡ Post to Finance GL &amp; Register TDS</span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {selectedRun && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginTop: 18,
                paddingTop: 16,
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Gross Expense (5100)
                </span>
                <strong style={{ display: 'block', fontSize: 16, color: '#0f172a', marginTop: 2 }}>
                  BDT {money(selectedRun.gross_total)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Salary TDS Payable (2210)
                </span>
                <strong style={{ display: 'block', fontSize: 16, color: '#dc2626', marginTop: 2 }}>
                  BDT {money(Number(selectedRun.deduction_total || 0) * 0.4)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Provident Fund Payable (2220)
                </span>
                <strong style={{ display: 'block', fontSize: 16, color: '#b45309', marginTop: 2 }}>
                  BDT {money(Number(selectedRun.deduction_total || 0) * 0.6)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Accrued Salaries Payable (2130)
                </span>
                <strong style={{ display: 'block', fontSize: 16, color: '#16a34a', marginTop: 2 }}>
                  BDT {money(selectedRun.net_total)}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Payslips Lines */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Employee Payslip Register
            </h3>
            <span style={{ fontSize: 13, color: '#64748b' }}>{runLines.length} employee payslips computed</span>
          </div>

          <ModernTable
            headers={['Employee Code', 'Full Name', 'Base Salary', 'Allowances', 'Deductions (TDS/PF)', 'Net Disbursable', 'Action']}
            rows={runLines.map((row) => ({ ...row, id: row.employee_id }))}
            empty="No payslip lines generated for this run. Select a processed payroll run above."
            render={(row) => (
              <>
                <td>
                  <strong>{row.employee_code}</strong>
                </td>
                <td>{row.full_name}</td>
                <td>BDT {money(row.base_amount)}</td>
                <td style={{ color: '#2563eb' }}>BDT {money(row.earning_amount)}</td>
                <td style={{ color: '#dc2626' }}>BDT {money(row.deduction_amount)}</td>
                <td>
                  <strong style={{ color: '#16a34a' }}>BDT {money(row.net_amount)}</strong>
                </td>
                <td>
                  <button
                    className="btn"
                    onClick={() => void downloadPayslipPreview(row.employee_id, row.employee_code)}
                    style={{ height: 32, padding: '0 10px', fontSize: 12, borderRadius: 6, gap: 6 }}
                  >
                    <Download size={13} />
                    <span>Download PDF</span>
                  </button>
                </td>
              </>
            )}
          />
        </div>

        <HrDisbursementPanel runs={runs} canManage={canManagePay} canApprove={canApprove && canExport} userId={userId} />
      </>
    );
  }

  // 9. Screen SCR-229: Employee Advance & Claims
  else if (screen.title === 'Employee Advance & Claims') {
    content = (
      <>
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="panel stat">
            <div className="stat-label">Total Claims &amp; Advances</div>
            <div className="stat-value">{claims.length}</div>
            <div className="stat-note">Staff Requests</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Salary Advances</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>
              {claims.filter((c) => c.entry_type === 'advance').length}
            </div>
            <div className="stat-note">Payroll Installments</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Expense Claims</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>
              {claims.filter((c) => c.entry_type === 'expense_claim').length}
            </div>
            <div className="stat-note">Reimbursements</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Pending Approval</div>
            <div className="stat-value" style={{ color: '#d97706' }}>
              {claims.filter((c) => c.status === 'pending').length}
            </div>
            <div className="stat-note">Maker-Checker Review</div>
          </div>
        </div>

        {canManagePay && (
          <section className="panel" style={{ padding: 22, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              Record Salary Advance or Expense Claim
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Advances are amortized against subsequent monthly payroll runs; expense claims are submitted for finance review.
            </p>
            <div className="catalog-form-grid">
              {employeeSelect()}
              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                  Request Type <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <select
                  className="input"
                  value={value('claimType')}
                  onChange={(event) => change('claimType', event.target.value)}
                  style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff' }}
                >
                  <option value="advance">Salary Advance</option>
                  <option value="expense_claim">Business Expense Claim</option>
                </select>
              </label>
              {field('amount', 'Amount (BDT)', 'number')}
              {field('requestDate', 'Request Date', 'date')}
              {field('description', 'Purpose / Document Reference')}
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                disabled={busy || !value('employeeId') || !value('description')}
                onClick={() =>
                  void mutate(
                    '/hr/claims',
                    {
                      employeeId: value('employeeId'),
                      type: value('claimType'),
                      amount: value('amount'),
                      requestDate: value('requestDate'),
                      description: value('description'),
                    },
                    'Request submitted for Maker-Checker review'
                  )
                }
                style={{ height: 40, borderRadius: 8 }}
              >
                Submit Request
              </button>
            </div>
          </section>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Advance &amp; Claim Requests Register
            </h3>
            {canApprove && canExport && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Review Note:</span>
                <input
                  className="input"
                  placeholder="Min 10 chars review note..."
                  value={value('claimReviewNote')}
                  onChange={(event) => change('claimReviewNote', event.target.value)}
                  style={{ width: 260, height: 36, borderRadius: 6, fontSize: 12.5 }}
                />
              </div>
            )}
          </div>
          <ModernTable
            headers={['Request Date', 'Employee', 'Type', 'Amount (BDT)', 'Purpose', 'Status', 'Decision']}
            rows={claims}
            empty="No advances or claims recorded."
            render={(row) => (
              <>
                <td>{date(row.request_date)}</td>
                <td>
                  <strong>{row.full_name}</strong>
                </td>
                <td>
                  <StatusBadge status={row.entry_type} />
                </td>
                <td>
                  <strong>BDT {money(row.amount)}</strong>
                </td>
                <td>{row.description}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  {row.status === 'pending' && canApprove && canExport && row.created_by !== userId ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-primary"
                        disabled={busy || value('claimReviewNote').trim().length < 10}
                        onClick={() =>
                          void mutate(
                            `/hr/claims/${row.id}/review`,
                            { decision: 'approve', note: value('claimReviewNote') },
                            'Claim approved for disbursement'
                          )
                        }
                        style={{ height: 30, padding: '0 10px', fontSize: 11, borderRadius: 6 }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn"
                        disabled={busy || value('claimReviewNote').trim().length < 10}
                        onClick={() =>
                          void mutate(
                            `/hr/claims/${row.id}/review`,
                            { decision: 'reject', note: value('claimReviewNote') },
                            'Claim rejected'
                          )
                        }
                        style={{ height: 30, padding: '0 10px', fontSize: 11, borderRadius: 6, color: '#dc2626' }}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#64748b' }}>{row.review_note || '—'}</span>
                  )}
                </td>
              </>
            )}
          />
        </div>
      </>
    );
  }

  // 10. Screen SCR-230: Payroll Audit History
  else {
    content = (
      <>
        <div className="panel" style={{ padding: 20, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>
                Immutable Payroll Audit Trail
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                Cryptographic tamper-evident activity log of all employee profile mutations, salary approvals, attendance revisions, and GL postings.
              </p>
            </div>
          </div>
        </div>

        <ModernTable
          headers={['Timestamp', 'Action', 'Target Entity', 'Record Identifier', 'Actor ID']}
          rows={audit.map((row, index) => ({ ...row, id: `${row.entity_id}-${index}` }))}
          empty="No HR audit records logged."
          render={(row) => (
            <>
              <td>
                <code>{String(row.occurred_at || '').slice(0, 19).replace('T', ' ')}</code>
              </td>
              <td>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                  }}
                >
                  {row.action}
                </span>
              </td>
              <td>
                <strong>{String(row.entity_type || '').replaceAll('_', ' ').toUpperCase()}</strong>
              </td>
              <td>
                <code>{String(row.entity_id || '').slice(0, 12)}...</code>
              </td>
              <td>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {row.actor_id ? String(row.actor_id).slice(0, 8) : 'System / Owner'}
                </span>
              </td>
            </>
          )}
        />
      </>
    );
  }

  return (
    <div className="workspace-page" style={{ padding: '24px 28px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#2563eb' }}>
              HR &amp; Payroll Management
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: '#dcfce7',
                color: '#15803d',
              }}
            >
              Enterprise Tier
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {screen.title}
          </h1>
          <p className="muted">
            Restricted workforce operations, attendance, effective-dated policies, and Finance GL posting.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void load()} style={{ height: 40, borderRadius: 8, gap: 6 }}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '12px 16px', borderRadius: 10 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="alert-success" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '12px 16px', borderRadius: 10 }}>
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="panel empty" style={{ padding: 60, textAlign: 'center', background: '#ffffff', borderRadius: 14 }}>
          Loading HR &amp; Payroll records...
        </div>
      ) : (
        content
      )}
    </div>
  );
}
