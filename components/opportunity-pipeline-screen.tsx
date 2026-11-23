"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  RefreshCw,
  Kanban,
  List,
  Building2,
  Calendar,
  DollarSign,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  X,
  BookOpen,
} from 'lucide-react';

export type Opportunity = {
  id: string;
  organization_id?: string;
  customer_id: string;
  customer_name: string;
  title: string;
  stage: 'lead' | 'qualified' | 'proposal' | 'won' | 'lost';
  expected_value: string | number;
  expected_close: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  version_no: number;
};

export type CustomerOption = {
  id: string;
  name: string;
  customer_code: string;
  customer_type: string;
};

const STAGES: {
  key: 'lead' | 'qualified' | 'proposal' | 'won' | 'lost';
  label: string;
  badgeBg: string;
  badgeColor: string;
  borderColor: string;
  description: string;
}[] = [
  {
    key: 'lead',
    label: 'Lead & Inquiry',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    borderColor: '#3b82f6',
    description: 'Initial syllabus inquiries & tenders',
  },
  {
    key: 'qualified',
    label: 'Qualified',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    borderColor: '#f59e0b',
    description: 'Budget & syllabus match confirmed',
  },
  {
    key: 'proposal',
    label: 'Proposal / Quote',
    badgeBg: '#f3e8ff',
    badgeColor: '#7e22ce',
    borderColor: '#8b5cf6',
    description: 'Formal price quote or tender bid submitted',
  },
  {
    key: 'won',
    label: 'Won / Contracted',
    badgeBg: '#ecfdf5',
    badgeColor: '#047857',
    borderColor: '#10b981',
    description: 'Purchase order received / bulk deal sealed',
  },
  {
    key: 'lost',
    label: 'Closed Lost',
    badgeBg: '#f1f5f9',
    badgeColor: '#475569',
    borderColor: '#94a3b8',
    description: 'Budget dropped, lost to competitor, or tender cancelled',
  },
];

function formatBdt(val: number | string | null | undefined): string {
  const num = Number(val || 0);
  return '৳' + num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(val: string | null | undefined): string {
  if (!val) return 'No close date';
  const str = String(val).slice(0, 10);
  try {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return str;
  }
}

function isOverdue(val: string | null | undefined, stage: string): boolean {
  if (!val || stage === 'won' || stage === 'lost') return false;
  const str = String(val).slice(0, 10);
  const nowStr = new Date().toISOString().slice(0, 10);
  return str < nowStr;
}

export function OpportunityPipelineScreen({ screen }: { screen: Screen }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Filters & View mode
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | 'lead' | 'qualified' | 'proposal' | 'won' | 'lost'>('all');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCloseDate, setNewCloseDate] = useState('');

  // Load Opportunities & Customer directory
  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [oppsRes, custRes] = await Promise.all([
        api<{ data: Opportunity[] }>('/crm/opportunities?limit=200'),
        api<{ data: CustomerOption[] }>('/customers?limit=150'),
      ]);
      setOpportunities(oppsRes.data || []);
      setCustomers(custRes.data || []);
      if (!newCustomerId && custRes.data?.length > 0) {
        setNewCustomerId(custRes.data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load opportunity pipeline');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Stage advancement
  async function handleStageChange(opp: Opportunity, targetStage: 'lead' | 'qualified' | 'proposal' | 'won' | 'lost') {
    setActionBusyId(opp.id);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: { id: string; stage: 'lead' | 'qualified' | 'proposal' | 'won' | 'lost'; version: number } }>(
        `/crm/opportunities/${opp.id}/stage`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            stage: targetStage,
            version: opp.version_no,
          }),
        }
      );

      setOpportunities(prev =>
        prev.map(item =>
          item.id === opp.id
            ? { ...item, stage: res.data.stage, version_no: res.data.version }
            : item
        )
      );

      const targetLabel = STAGES.find(s => s.key === targetStage)?.label || targetStage;
      setNotice(`Moved "${opp.title}" to ${targetLabel}`);
      setTimeout(() => setNotice(''), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update opportunity stage');
    } finally {
      setActionBusyId(null);
    }
  }

  // Create Opportunity
  async function handleCreateOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      setModalError('Opportunity deal title is required');
      return;
    }
    if (!newCustomerId) {
      setModalError('Please select a customer or institution');
      return;
    }
    const numericVal = parseFloat(newValue || '0');
    if (isNaN(numericVal) || numericVal < 0) {
      setModalError('Please provide a valid expected value');
      return;
    }

    setModalBusy(true);
    setModalError('');
    try {
      await api('/crm/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          customerId: newCustomerId,
          expectedValue: numericVal,
          expectedClose: newCloseDate ? newCloseDate : null,
        }),
      });

      setShowCreateModal(false);
      setNewTitle('');
      setNewValue('');
      setNewCloseDate('');
      setNotice('New B2B opportunity created successfully in Lead stage!');
      setTimeout(() => setNotice(''), 4500);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to create opportunity');
    } finally {
      setModalBusy(false);
    }
  }

  // Metrics computation
  const metrics = useMemo(() => {
    let totalPipeline = 0;
    let openCount = 0;
    let wonValue = 0;
    let wonCount = 0;
    let totalValueAll = 0;

    opportunities.forEach(o => {
      const val = Number(o.expected_value || 0);
      totalValueAll += val;
      if (['lead', 'qualified', 'proposal'].includes(o.stage)) {
        totalPipeline += val;
        openCount++;
      } else if (o.stage === 'won') {
        wonValue += val;
        wonCount++;
      }
    });

    const avgDeal = opportunities.length > 0 ? totalValueAll / opportunities.length : 0;
    const winRate = opportunities.length > 0 ? Math.round((wonCount / opportunities.length) * 100) : 0;

    return { totalPipeline, openCount, wonValue, wonCount, avgDeal, winRate };
  }, [opportunities]);

  // Filtered list
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      if (stageFilter !== 'all' && opp.stage !== stageFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = opp.title.toLowerCase().includes(q);
        const matchCustomer = (opp.customer_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCustomer) return false;
      }
      return true;
    });
  }, [opportunities, stageFilter, search]);

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
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#2563eb' }}>
              B2B Institutional Deals
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Opportunity Pipeline
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Track school curriculum adoptions, college library procurements, and national book tenders through every deal milestone.
          </p>
        </div>

        {/* TOP CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 600,
                background: viewMode === 'kanban' ? '#ffffff' : 'transparent',
                color: viewMode === 'kanban' ? '#0f172a' : '#64748b',
                boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Kanban size={15} />
              <span>Kanban Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 600,
                background: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? '#0f172a' : '#64748b',
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <List size={15} />
              <span>Table View</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadData()}
            disabled={loading}
            title="Refresh Pipeline"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              setModalError('');
              setShowCreateModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', borderColor: '#2563eb' }}
          >
            <Plus size={16} />
            <span>New Opportunity</span>
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
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Pipeline Value</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {formatBdt(metrics.totalPipeline)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            In {metrics.openCount} open inquiries & bids
          </div>
        </div>

        {/* Metric 2 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Won Revenue</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>
            {formatBdt(metrics.wonValue)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {metrics.wonCount} deals contracted ({metrics.winRate}% win rate)
          </div>
        </div>

        {/* Metric 3 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Average Deal Size</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {formatBdt(metrics.avgDeal)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Across {opportunities.length} institutional accounts
          </div>
        </div>

        {/* Metric 4 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Customer Directory</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              <Building2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {customers.length}
          </div>
          <div style={{ fontSize: 12, color: '#2563eb', marginTop: 4 }}>
            <Link href="/crm-customers/customer-profile" style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 600 }}>
              View 360° Profiles →
            </Link>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
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
              placeholder="Search opportunity title or institution..."
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

        {/* Stage Filter Chips (for table or fast filter) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginRight: 4 }}>Filter Stage:</span>
          <button
            type="button"
            onClick={() => setStageFilter('all')}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid',
              borderColor: stageFilter === 'all' ? '#2563eb' : '#e2e8f0',
              background: stageFilter === 'all' ? '#eff6ff' : '#ffffff',
              color: stageFilter === 'all' ? '#1d4ed8' : '#64748b',
              fontWeight: stageFilter === 'all' ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            All ({opportunities.length})
          </button>
          {STAGES.map(s => {
            const count = opportunities.filter(o => o.stage === s.key).length;
            const isSelected = stageFilter === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStageFilter(s.key)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: isSelected ? s.borderColor : '#e2e8f0',
                  background: isSelected ? s.badgeBg : '#ffffff',
                  color: isSelected ? s.badgeColor : '#64748b',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {s.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN VIEW: KANBAN BOARD */}
      {viewMode === 'kanban' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(250px, 1fr))',
            gap: 16,
            alignItems: 'start',
            overflowX: 'auto',
            paddingBottom: 20,
          }}
        >
          {STAGES.map(col => {
            const colOpps = filteredOpportunities.filter(o => o.stage === col.key);
            const colTotalVal = colOpps.reduce((acc, cur) => acc + Number(cur.expected_value || 0), 0);

            return (
              <div
                key={col.key}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 520,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                {/* Column Header */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderBottom: '2px solid ' + col.borderColor,
                    background: '#ffffff',
                    borderTopLeftRadius: 14,
                    borderTopRightRadius: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{col.label}</span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: col.badgeBg,
                        color: col.badgeColor,
                      }}
                    >
                      {colOpps.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Total Value</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                      {formatBdt(colTotalVal)}
                    </span>
                  </div>
                </div>

                {/* Column Cards Container */}
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  {colOpps.length === 0 ? (
                    <div
                      style={{
                        padding: '36px 12px',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: 12.5,
                        border: '1px dashed #cbd5e1',
                        borderRadius: 10,
                        background: '#ffffff',
                      }}
                    >
                      No deals in this stage
                    </div>
                  ) : (
                    colOpps.map(opp => {
                      const isBusy = actionBusyId === opp.id;
                      const overdue = isOverdue(opp.expected_close, opp.stage);

                      return (
                        <div
                          key={opp.id}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: 14,
                            boxShadow: '0 2px 4px rgba(15, 23, 42, 0.04)',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          {/* Deal Title */}
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                            {opp.title}
                          </div>

                          {/* Customer / Institution */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                            <Building2 size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {opp.customer_name || 'Direct Account'}
                            </span>
                          </div>

                          {/* Value & Close Date Row */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: '#f8fafc',
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: '1px solid #f1f5f9',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Value</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d' }}>
                                {formatBdt(opp.expected_value)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Target Close</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: overdue ? '#dc2626' : '#334155' }}>
                                <Calendar size={12} />
                                <span>{formatDate(opp.expected_close)}</span>
                              </div>
                            </div>
                          </div>

                          {overdue && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                              <Clock size={11} />
                              <span>Milestone past target close date</span>
                            </div>
                          )}

                          {/* Stage Action Controls */}
                          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {/* Actions from LEAD */}
                            {opp.stage === 'lead' && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleStageChange(opp, 'qualified')}
                                  style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 5,
                                    padding: '6px 10px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    border: '1px solid #fed7aa',
                                    background: '#fff7ed',
                                    color: '#c2410c',
                                    cursor: 'pointer',
                                  }}
                                  title="Verify budget and booklist requirements"
                                >
                                  <span>Qualify</span>
                                  <ArrowRight size={13} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleStageChange(opp, 'lost')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: '#ffffff',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                  }}
                                  title="Mark as lost / dropped"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            )}

                            {/* Actions from QUALIFIED */}
                            {opp.stage === 'qualified' && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleStageChange(opp, 'proposal')}
                                  style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 5,
                                    padding: '6px 10px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    border: '1px solid #ddd6fe',
                                    background: '#f5f3ff',
                                    color: '#6d28d9',
                                    cursor: 'pointer',
                                  }}
                                  title="Submit quotation or tender bid"
                                >
                                  <span>Send Proposal</span>
                                  <ArrowRight size={13} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleStageChange(opp, 'lost')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: '#ffffff',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                  }}
                                  title="Mark as lost / dropped"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            )}

                            {/* Actions from PROPOSAL */}
                            {opp.stage === 'proposal' && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleStageChange(opp, 'won')}
                                  style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 5,
                                    padding: '6px 10px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    border: '1px solid #bbf7d0',
                                    background: '#f0fdf4',
                                    color: '#15803d',
                                    cursor: 'pointer',
                                  }}
                                  title="Mark Won (Purchase order received)"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Won Deal</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleStageChange(opp, 'qualified')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: '#ffffff',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                  }}
                                  title="Revise back to Qualified"
                                >
                                  <RotateCcw size={12} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleStageChange(opp, 'lost')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: '#ffffff',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                  }}
                                  title="Mark as lost / competitor chosen"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            )}

                            {/* Terminal WON */}
                            {opp.stage === 'won' && (
                              <div
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  color: '#15803d',
                                  padding: '4px 8px',
                                  background: '#f0fdf4',
                                  borderRadius: 6,
                                }}
                              >
                                <CheckCircle2 size={13} />
                                <span>Contract Signed & Ready for Order</span>
                              </div>
                            )}

                            {/* Terminal LOST */}
                            {opp.stage === 'lost' && (
                              <div
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: '#64748b',
                                  padding: '4px 8px',
                                  background: '#f8fafc',
                                  borderRadius: 6,
                                }}
                              >
                                <XCircle size={13} />
                                <span>Opportunity Archived</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MAIN VIEW: DATA TABLE */
        <div className="panel" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Opportunity / Deal Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Customer / Institution</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Stage</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Expected Value</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Target Close</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Advance / Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpportunities.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                      No opportunities found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOpportunities.map(opp => {
                    const stageConfig = STAGES.find(s => s.key === opp.stage);
                    const isBusy = actionBusyId === opp.id;
                    const overdue = isOverdue(opp.expected_close, opp.stage);

                    return (
                      <tr key={opp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{opp.title}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Building2 size={13} style={{ color: '#64748b' }} />
                            <span>{opp.customer_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: stageConfig?.badgeBg || '#f1f5f9',
                              color: stageConfig?.badgeColor || '#475569',
                              display: 'inline-block',
                            }}
                          >
                            {stageConfig?.label || opp.stage}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#15803d' }}>
                          {formatBdt(opp.expected_value)}
                        </td>
                        <td style={{ padding: '12px 16px', color: overdue ? '#dc2626' : '#334155' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <Calendar size={13} />
                            <span>{formatDate(opp.expected_close)}</span>
                            {overdue && (
                              <span style={{ fontSize: 10, background: '#fef2f2', color: '#dc2626', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            {opp.stage === 'lead' && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={isBusy}
                                onClick={() => void handleStageChange(opp, 'qualified')}
                                style={{ padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#c2410c' }}
                              >
                                Qualify →
                              </button>
                            )}
                            {opp.stage === 'qualified' && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={isBusy}
                                onClick={() => void handleStageChange(opp, 'proposal')}
                                style={{ padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#6d28d9' }}
                              >
                                Send Proposal →
                              </button>
                            )}
                            {opp.stage === 'proposal' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={isBusy}
                                onClick={() => void handleStageChange(opp, 'won')}
                                style={{ padding: '4px 10px', fontSize: 11.5, fontWeight: 700, background: '#16a34a', borderColor: '#16a34a' }}
                              >
                                Mark Won ✓
                              </button>
                            )}
                            {opp.stage === 'won' && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>Won Deal</span>
                            )}
                            {opp.stage === 'lost' && (
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>Closed Lost</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE OPPORTUNITY MODAL */}
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
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <BookOpen size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    New Institutional Opportunity
                  </h2>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                    Register a new syllabus inquiry, library procurement tender, or wholesale deal.
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

            {modalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12.5 }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateOpportunity} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Customer Selector */}
              <div>
                <label htmlFor="opp-customer" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Customer / Institution <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  id="opp-customer"
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
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Institution or bookseller who requested the syllabus proposal or book tender.
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label htmlFor="opp-title" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Opportunity Title <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="opp-title"
                  name="title"
                  type="text"
                  className="input"
                  placeholder="e.g., Notre Dame College — HSC Physics & Chem 2027 Syllabus (2,000 sets)"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  style={{ width: '100%', height: 38, fontSize: 13, background: '#ffffff', color: '#0f172a' }}
                  required
                />
              </div>

              {/* Expected Value & Close Date Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label htmlFor="opp-value" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Expected Value (BDT ৳)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 13, fontWeight: 700, color: '#64748b' }}>৳</span>
                    <input
                      id="opp-value"
                      name="expected_value"
                      type="number"
                      step="1000"
                      min="0"
                      className="input"
                      placeholder="500000"
                      value={newValue}
                      onChange={e => setNewValue(e.target.value)}
                      style={{ width: '100%', height: 38, paddingLeft: 28, fontSize: 13, background: '#ffffff', color: '#0f172a' }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="opp-close" style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Target Close Date
                  </label>
                  <input
                    id="opp-close"
                    name="expected_close"
                    type="date"
                    className="input"
                    value={newCloseDate}
                    onChange={e => setNewCloseDate(e.target.value)}
                    style={{ width: '100%', height: 38, fontSize: 13, background: '#ffffff', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Initial Stage indicator */}
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
                New opportunities automatically start in the <strong>Lead & Inquiry</strong> stage with version tracking.
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={modalBusy}
                  style={{ height: 38, padding: '0 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalBusy}
                  style={{ height: 38, padding: '0 20px', background: '#2563eb', borderColor: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {modalBusy && <RefreshCw size={14} className="spin" />}
                  <span>{modalBusy ? 'Saving...' : 'Create Opportunity'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
