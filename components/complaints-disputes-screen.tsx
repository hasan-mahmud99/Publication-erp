"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Search,
  RefreshCw,
  X,
  MessageSquare,
  ShieldAlert,
  Building2,
  Calendar,
  AlertCircle,
  RotateCcw,
  User,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';

export type CustomerCase = {
  id: string;
  organization_id?: string;
  customer_id: string;
  customer_name: string;
  case_type: 'complaint' | 'dispute';
  subject: string;
  description: string | null;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  resolution: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  due_date: string | null;
  escalated_at: string | null;
  created_at: string;
  updated_at: string;
  version_no: number;
};

export type CustomerOption = {
  id: string;
  name: string;
  customer_code: string;
  customer_type: string;
};

function formatDate(val: string | null | undefined): string {
  if (!val) return 'No due date';
  const str = String(val).slice(0, 10);
  try {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return str;
  }
}

function isOverdue(val: string | null | undefined, status: string): boolean {
  if (!val || status === 'resolved' || status === 'closed') return false;
  const str = String(val).slice(0, 10);
  const nowStr = new Date().toISOString().slice(0, 10);
  return str < nowStr;
}

export function ComplaintsDisputesScreen({ screen }: { screen: Screen }) {
  const [cases, setCases] = useState<CustomerCase[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_review' | 'resolved' | 'closed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'complaint' | 'dispute'>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newType, setNewType] = useState<'complaint' | 'dispute'>('complaint');
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  // Resolve Modal
  const [resolvingCase, setResolvingCase] = useState<CustomerCase | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [resolveBusy, setResolveBusy] = useState(false);
  const [resolveError, setResolveError] = useState('');

  // Escalate Modal
  const [escalatingCase, setEscalatingCase] = useState<CustomerCase | null>(null);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateBusy, setEscalateBusy] = useState(false);
  const [escalateError, setEscalateError] = useState('');

  // Fetch Cases and Customers
  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [casesRes, custRes] = await Promise.all([
        api<{ data: CustomerCase[] }>('/crm/cases?limit=150'),
        api<{ data: CustomerOption[] }>('/customers?limit=150'),
      ]);
      setCases(casesRes.data || []);
      setCustomers(custRes.data || []);
      if (!newCustomerId && custRes.data?.length > 0) {
        setNewCustomerId(custRes.data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load complaints and disputes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Status transitions
  async function handleStatusTransition(targetCase: CustomerCase, targetStatus: 'open' | 'in_review' | 'resolved' | 'closed', resolution?: string) {
    setActionBusyId(targetCase.id);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: { id: string; status: 'open' | 'in_review' | 'resolved' | 'closed'; version: number } }>(
        `/crm/cases/${targetCase.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: targetStatus,
            resolution: resolution !== undefined ? resolution : targetCase.resolution,
            version: targetCase.version_no,
          }),
        }
      );

      setCases(prev =>
        prev.map(c =>
          c.id === targetCase.id
            ? { ...c, status: res.data.status, resolution: resolution ?? c.resolution, version_no: res.data.version }
            : c
        )
      );

      setNotice(`Case updated to "${targetStatus.replace('_', ' ').toUpperCase()}" successfully.`);
      setTimeout(() => setNotice(''), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to transition case status');
    } finally {
      setActionBusyId(null);
    }
  }

  // Resolve submit
  async function handleConfirmResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvingCase) return;
    if (!resolutionText.trim()) {
      setResolveError('Resolution details are required (e.g., replacement challan issued, credit note applied).');
      return;
    }

    setResolveBusy(true);
    setResolveError('');
    try {
      await handleStatusTransition(resolvingCase, 'resolved', resolutionText.trim());
      setResolvingCase(null);
      setResolutionText('');
    } catch (err: any) {
      setResolveError(err?.message || 'Failed to resolve case');
    } finally {
      setResolveBusy(false);
    }
  }

  // Escalate submit
  async function handleConfirmEscalate(e: React.FormEvent) {
    e.preventDefault();
    if (!escalatingCase) return;
    if (!escalateReason.trim()) {
      setEscalateError('Please provide a reason for management escalation.');
      return;
    }

    setEscalateBusy(true);
    setEscalateError('');
    try {
      const res = await api<{ data: { id: string; version: number; escalated: boolean } }>(
        `/crm/cases/${escalatingCase.id}/escalate`,
        {
          method: 'POST',
          body: JSON.stringify({
            version: escalatingCase.version_no,
            reason: escalateReason.trim(),
          }),
        }
      );

      setCases(prev =>
        prev.map(c =>
          c.id === escalatingCase.id
            ? { ...c, escalated_at: new Date().toISOString(), version_no: res.data.version }
            : c
        )
      );

      setEscalatingCase(null);
      setEscalateReason('');
      setNotice(`Case "${escalatingCase.subject}" has been escalated to senior management!`);
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      setEscalateError(err?.message || 'Failed to escalate case');
    } finally {
      setEscalateBusy(false);
    }
  }

  // Create Case
  async function handleCreateCase(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim()) {
      setCreateError('Case subject is required');
      return;
    }
    if (!newCustomerId) {
      setCreateError('Please select an affected customer');
      return;
    }

    setCreateBusy(true);
    setCreateError('');
    try {
      await api('/crm/cases', {
        method: 'POST',
        body: JSON.stringify({
          customerId: newCustomerId,
          type: newType,
          subject: newSubject.trim(),
          description: newDescription.trim() || null,
          dueDate: newDueDate || null,
        }),
      });

      setShowCreateModal(false);
      setNewSubject('');
      setNewDescription('');
      setNewDueDate('');
      setNotice('Customer issue registered successfully with Open status.');
      setTimeout(() => setNotice(''), 4500);
      await loadData();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to register customer case');
    } finally {
      setCreateBusy(false);
    }
  }

  // Metrics computation
  const metrics = useMemo(() => {
    let openCount = 0;
    let inReviewCount = 0;
    let escalatedCount = 0;
    let disputeCount = 0;
    let resolvedCount = 0;

    cases.forEach(c => {
      if (c.status === 'open') openCount++;
      if (c.status === 'in_review') inReviewCount++;
      if (c.escalated_at) escalatedCount++;
      if (c.case_type === 'dispute') disputeCount++;
      if (c.status === 'resolved' || c.status === 'closed') resolvedCount++;
    });

    return {
      activeCount: openCount + inReviewCount,
      escalatedCount,
      disputeCount,
      resolvedCount,
    };
  }, [cases]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (typeFilter !== 'all' && c.case_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchSubj = c.subject.toLowerCase().includes(q);
        const matchCust = (c.customer_name || '').toLowerCase().includes(q);
        const matchDesc = (c.description || '').toLowerCase().includes(q);
        if (!matchSubj && !matchCust && !matchDesc) return false;
      }
      return true;
    });
  }, [cases, statusFilter, typeFilter, search]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
              CRM & Customer Management
            </span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c' }}>
              Customer Support & Dispute Desk
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Complaints & Commercial Disputes
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Resolve print misprints, damaged transit shipments, invoice discount disputes, and unauthorized market piracy claims.
          </p>
        </div>

        {/* TOP CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadData()}
            disabled={loading}
            title="Refresh List"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              setCreateError('');
              setShowCreateModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#dc2626', borderColor: '#dc2626' }}
          >
            <Plus size={16} />
            <span>Log Complaint / Dispute</span>
          </button>
        </div>
      </div>

      {/* NOTICES & ALERTS */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Metric 1 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Inquiries</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>
            {metrics.activeCount}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Pending investigation or resolution
          </div>
        </div>

        {/* Metric 2 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Escalated To Management</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <ShieldAlert size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ea580c' }}>
            {metrics.escalatedCount}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            High-priority publisher attention
          </div>
        </div>

        {/* Metric 3 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Commercial Disputes</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
              <FileText size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>
            {metrics.disputeCount}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Invoice discounts & ledger claims
          </div>
        </div>

        {/* Metric 4 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Resolved & Closed</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>
            {metrics.resolvedCount}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Settled with credit or replacement
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 320px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
            <input
              type="text"
              className="input"
              placeholder="Search complaint subject, institution, or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 38, width: '100%', fontSize: 13 }}
            />
          </div>
          {search && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSearch('')}
              style={{ height: 38, padding: '0 10px', color: '#64748b' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Type filter */}
          <select
            className="input"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            style={{ height: 38, fontSize: 12.5, background: '#ffffff', color: '#0f172a' }}
          >
            <option value="all">All Types</option>
            <option value="complaint">Complaints (Print / Delivery)</option>
            <option value="dispute">Disputes (Commercial / Invoices)</option>
          </select>

          {/* Status chips */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            {(['all', 'open', 'in_review', 'resolved', 'closed'] as const).map(st => {
              const count = st === 'all' ? cases.length : cases.filter(c => c.status === st).length;
              const isSelected = statusFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: isSelected ? '#ffffff' : 'transparent',
                    color: isSelected ? '#0f172a' : '#64748b',
                    boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    textTransform: 'capitalize',
                  }}
                >
                  {st.replace('_', ' ')} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CASES WORKSPACE LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredCases.length === 0 ? (
          <div
            className="panel"
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#64748b',
            }}
          >
            <MessageSquare size={36} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>No Cases Found</h3>
            <p style={{ fontSize: 13, margin: 0 }}>
              There are no customer complaints or disputes matching your current filter criteria.
            </p>
          </div>
        ) : (
          filteredCases.map(item => {
            const isBusy = actionBusyId === item.id;
            const overdue = isOverdue(item.due_date, item.status);
            const isDispute = item.case_type === 'dispute';
            const isEscalated = Boolean(item.escalated_at);

            return (
              <div
                key={item.id}
                className="panel"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Row 1: Badges, Title & Quick Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ flex: '1 1 500px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      {/* Case Type Badge */}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: isDispute ? '#f5f3ff' : '#fef2f2',
                          color: isDispute ? '#7c3aed' : '#dc2626',
                          border: '1px solid ' + (isDispute ? '#ddd6fe' : '#fecaca'),
                        }}
                      >
                        {isDispute ? 'Commercial Dispute' : 'Customer Complaint'}
                      </span>

                      {/* Status Badge */}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 6,
                          background:
                            item.status === 'open'
                              ? '#fff7ed'
                              : item.status === 'in_review'
                              ? '#eff6ff'
                              : item.status === 'resolved'
                              ? '#ecfdf5'
                              : '#f1f5f9',
                          color:
                            item.status === 'open'
                              ? '#c2410c'
                              : item.status === 'in_review'
                              ? '#1d4ed8'
                              : item.status === 'resolved'
                              ? '#15803d'
                              : '#475569',
                        }}
                      >
                        {item.status.replace('_', ' ')}
                      </span>

                      {/* Escalated Tag */}
                      {isEscalated && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#7f1d1d',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <ShieldAlert size={12} />
                          <span>ESCALATED TO PUBLISHER</span>
                        </span>
                      )}

                      {/* Overdue Tag */}
                      {overdue && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Clock size={12} />
                          <span>SLA Overdue</span>
                        </span>
                      )}
                    </div>

                    {/* Subject Header */}
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                      {item.subject}
                    </h3>

                    {/* Customer & Assignee Meta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Building2 size={14} style={{ color: '#475569' }} />
                        <Link
                          href="/crm-customers/customer-profile"
                          style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                        >
                          {item.customer_name}
                        </Link>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={14} style={{ color: '#64748b' }} />
                        <span>Assigned to: <strong>{item.assignee_name || 'Unassigned Support'}</strong></span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Calendar size={14} style={{ color: overdue ? '#dc2626' : '#64748b' }} />
                        <span style={{ color: overdue ? '#dc2626' : '#64748b', fontWeight: overdue ? 700 : 500 }}>
                          Target Resolution: {formatDate(item.due_date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side: Action Workflow Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* OPEN -> Start Review */}
                    {item.status === 'open' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={isBusy}
                        onClick={() => void handleStatusTransition(item, 'in_review')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', borderColor: '#2563eb' }}
                      >
                        <span>Start Investigation</span>
                        <ArrowRight size={14} />
                      </button>
                    )}

                    {/* IN REVIEW -> Resolve */}
                    {item.status === 'in_review' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={isBusy}
                          onClick={() => {
                            setResolveError('');
                            setResolutionText('');
                            setResolvingCase(item);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#16a34a', borderColor: '#16a34a' }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Resolve Case</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={isBusy}
                          onClick={() => void handleStatusTransition(item, 'open')}
                          style={{ color: '#64748b' }}
                          title="Revert back to Open"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </>
                    )}

                    {/* RESOLVED -> Close */}
                    {item.status === 'resolved' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={isBusy}
                          onClick={() => void handleStatusTransition(item, 'closed')}
                          style={{ background: '#334155', borderColor: '#334155' }}
                        >
                          Finalize & Close
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={isBusy}
                          onClick={() => void handleStatusTransition(item, 'in_review')}
                          style={{ color: '#64748b' }}
                          title="Reopen for further review"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </>
                    )}

                    {/* Escalate button (only if open/in_review and not escalated yet) */}
                    {['open', 'in_review'].includes(item.status) && !isEscalated && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={isBusy}
                        onClick={() => {
                          setEscalateError('');
                          setEscalateReason('');
                          setEscalatingCase(item);
                        }}
                        style={{ color: '#ea580c', borderColor: '#fed7aa', background: '#fff7ed', display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <ShieldAlert size={14} />
                        <span>Escalate</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Description details */}
                {item.description && (
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                    <strong>Customer Claim:</strong> {item.description}
                  </div>
                )}

                {/* Resolution summary (if present) */}
                {item.resolution && (
                  <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #dcfce7', fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 2 }}>
                      <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                      <span>Resolution & Corrective Action Taken:</span>
                    </div>
                    <div>{item.resolution}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* RESOLVE CASE MODAL */}
      {resolvingCase && (
        <div
          className="modal-backdrop"
          onClick={() => setResolvingCase(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 580,
              width: '100%',
              background: '#ffffff',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Resolve Customer Case
                  </h2>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                    Document the operational settlement, credit note, or warehouse replacement.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setResolvingCase(null)}
                style={{ padding: '6px 8px', border: 'none', background: 'transparent', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {resolveError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12.5 }}>
                {resolveError}
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Subject</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{resolvingCase.subject}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Customer: {resolvingCase.customer_name}</div>
            </div>

            <form onSubmit={handleConfirmResolve}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="resolution-input" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Resolution Details & Settlement Action <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  id="resolution-input"
                  name="resolution"
                  className="input"
                  rows={4}
                  placeholder="e.g., Replacement stock of 50 copies dispatched under Challan #CH-9921 via SA Paribahan. Binder penalised for batch defect."
                  value={resolutionText}
                  onChange={e => setResolutionText(e.target.value)}
                  style={{ width: '100%', fontSize: 13, background: '#ffffff', color: '#0f172a', padding: 10 }}
                  required
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  This resolution will be permanently archived in the Customer 360° Profile audit log.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setResolvingCase(null)}
                  disabled={resolveBusy}
                  style={{ height: 38, padding: '0 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={resolveBusy}
                  style={{ height: 38, padding: '0 20px', background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {resolveBusy && <RefreshCw size={14} className="spin" />}
                  <span>{resolveBusy ? 'Saving...' : 'Confirm Resolution'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESCALATE CASE MODAL */}
      {escalatingCase && (
        <div
          className="modal-backdrop"
          onClick={() => setEscalatingCase(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 540,
              width: '100%',
              background: '#ffffff',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Escalate to Senior Management
                  </h2>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                    Elevate this dispute for urgent executive, legal, or editorial intervention.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setEscalatingCase(null)}
                style={{ padding: '6px 8px', border: 'none', background: 'transparent', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {escalateError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12.5 }}>
                {escalateError}
              </div>
            )}

            <form onSubmit={handleConfirmEscalate}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="escalate-reason" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Escalation Justification & Urgency <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  id="escalate-reason"
                  name="reason"
                  className="input"
                  rows={4}
                  placeholder="e.g., Counterfeit copies discovered in Nilkhet market requires publisher legal notice to anti-piracy task force."
                  value={escalateReason}
                  onChange={e => setEscalateReason(e.target.value)}
                  style={{ width: '100%', fontSize: 13, background: '#ffffff', color: '#0f172a', padding: 10 }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEscalatingCase(null)}
                  disabled={escalateBusy}
                  style={{ height: 38, padding: '0 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={escalateBusy}
                  style={{ height: 38, padding: '0 20px', background: '#ea580c', borderColor: '#ea580c', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {escalateBusy && <RefreshCw size={14} className="spin" />}
                  <span>{escalateBusy ? 'Escalating...' : 'Confirm Escalation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CASE MODAL */}
      {showCreateModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowCreateModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 580,
              width: '100%',
              background: '#ffffff',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Log Complaint / Commercial Dispute
                  </h2>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                    Register a bookstore grievance, quality defect, or invoice discrepancy.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowCreateModal(false)}
                style={{ padding: '6px 8px', border: 'none', background: 'transparent', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12.5 }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCase} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Customer Selector */}
              <div>
                <label htmlFor="case-customer" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Customer / Institution <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  id="case-customer"
                  name="customer_id"
                  className="input"
                  value={newCustomerId}
                  onChange={e => setNewCustomerId(e.target.value)}
                  style={{ width: '100%', height: 38, fontSize: 13, background: '#ffffff', color: '#0f172a' }}
                  required
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customer_type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Case Type & SLA Due Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label htmlFor="case-type" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Issue Type <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    id="case-type"
                    name="case_type"
                    className="input"
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    style={{ width: '100%', height: 38, fontSize: 13, background: '#ffffff', color: '#0f172a' }}
                    required
                  >
                    <option value="complaint">Complaint (Print / Delivery / Quality)</option>
                    <option value="dispute">Dispute (Commercial / Discount / Invoice)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="case-due-date" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Resolution Due Date
                  </label>
                  <input
                    id="case-due-date"
                    name="due_date"
                    type="date"
                    className="input"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    style={{ width: '100%', height: 38, fontSize: 13, background: '#ffffff', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="case-subject" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Subject / Summary <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="case-subject"
                  name="subject"
                  type="text"
                  className="input"
                  placeholder="e.g., 50 copies of HSC Bangla have upside-down pages in Lot #PB-2026-08"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  style={{ width: '100%', height: 38, fontSize: 13, background: '#ffffff', color: '#0f172a' }}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="case-description" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Detailed Grievance Description
                </label>
                <textarea
                  id="case-description"
                  name="description"
                  className="input"
                  rows={3}
                  placeholder="Include invoice numbers, book titles, lot numbers, or courier tracking numbers..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  style={{ width: '100%', fontSize: 13, background: '#ffffff', color: '#0f172a', padding: 10 }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createBusy}
                  style={{ height: 38, padding: '0 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createBusy}
                  style={{ height: 38, padding: '0 20px', background: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {createBusy && <RefreshCw size={14} className="spin" />}
                  <span>{createBusy ? 'Registering...' : 'Register Issue'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
