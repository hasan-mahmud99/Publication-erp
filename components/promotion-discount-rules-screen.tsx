"use client";

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

export type PromotionRule = {
  id: string;
  promotion_code: string;
  name: string;
  campaign_id: string | null;
  campaign_name?: string | null;
  edition_id: string;
  edition_code?: string;
  edition_number?: string;
  format?: string;
  book_title?: string;
  retail_price?: number | string;
  sales_channel: string;
  start_date: string;
  end_date: string;
  discount_bps: number;
  priority: number;
  stacking_policy: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  version_no: number;
  created_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
};

export type ConflictRecord = {
  first_id: string;
  first_code: string;
  first_status: string;
  second_id: string;
  second_code: string;
  second_status: string;
  edition_code: string;
  sales_channel: string;
  overlap_from: string;
  overlap_to: string;
};

export type EditionOption = {
  id: string;
  edition_code: string;
  edition_number?: string;
  format?: string;
  book_title?: string;
  retail_price?: number | string;
};

export type CampaignOption = {
  id: string;
  campaign_code: string;
  name: string;
  status: string;
};

export type ActionHistory = {
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  actor_name: string;
  occurred_at: string;
};

type FormState = {
  code: string;
  name: string;
  campaignId: string;
  editionId: string;
  channel: string;
  startDate: string;
  endDate: string;
  discountPercent: string;
  priority: string;
};

const CHANNELS = [
  { id: 'book_fair', label: 'Boi Mela & Fair POS', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'retail', label: 'Retail Bookstore', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'ecommerce', label: 'E-Commerce / Online', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  { id: 'wholesale', label: 'Wholesale Trade', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  { id: 'distributor', label: 'National Distributor', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { id: 'institutional', label: 'Institutional / Library', color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
];

const emptyForm = (): FormState => {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  return {
    code: `PROM-${Math.floor(1000 + Math.random() * 9000)}`,
    name: '',
    campaignId: '',
    editionId: '',
    channel: 'retail',
    startDate: today.toISOString().split('T')[0],
    endDate: nextMonth.toISOString().split('T')[0],
    discountPercent: '20.00',
    priority: '100'
  };
};

export function PromotionDiscountRulesScreen({ screen }: { screen: Screen }) {
  const [rules, setRules] = useState<PromotionRule[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [editions, setEditions] = useState<EditionOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [me, setMe] = useState<{ userId: string; role: string; permissions: string[] } | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'rejected'>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // Review Modal
  const [activeRuleDetail, setActiveRuleDetail] = useState<{ promotion: PromotionRule; history: ActionHistory[] } | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [reviewReason, setReviewReason] = useState('');

  // Authoring Modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);

  const canManage = me?.role === 'Owner' || Boolean(me?.permissions.includes('marketing.manage'));
  const canApprove = me?.role === 'Owner' || Boolean(me?.permissions.includes('marketing.approve'));

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [rulesRes, conflictsRes, optsRes, campsRes, meRes] = await Promise.all([
        api<{ data: PromotionRule[] }>('/marketing/promotions'),
        api<{ data: ConflictRecord[] }>('/marketing/promotions/conflicts'),
        api<{ data: { editions: EditionOption[] } }>('/marketing/options'),
        api<{ data: CampaignOption[] }>('/marketing/campaigns?limit=100'),
        api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me')
      ]);
      setRules(rulesRes.data || []);
      setConflicts(conflictsRes.data || []);
      setEditions(optsRes.data.editions || []);
      setCampaigns(campsRes.data || []);
      setMe(meRes.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load promotion data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const matchesSearch =
        !searchQuery.trim() ||
        r.promotion_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.book_title && r.book_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.edition_code && r.edition_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.campaign_name && r.campaign_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesChannel = channelFilter === 'all' || r.sales_channel === channelFilter;

      return matchesSearch && matchesStatus && matchesChannel;
    });
  }, [rules, searchQuery, statusFilter, channelFilter]);

  // Executive Metrics
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const approvedRules = rules.filter(r => r.status === 'approved');
    const activeRules = approvedRules.filter(r => r.start_date.slice(0, 10) <= todayStr && r.end_date.slice(0, 10) >= todayStr);
    const avgDiscountBps = approvedRules.length
      ? approvedRules.reduce((sum, r) => sum + Number(r.discount_bps), 0) / approvedRules.length
      : 0;
    const channelsCovered = new Set(approvedRules.map(r => r.sales_channel)).size;

    return {
      total: rules.length,
      activeNow: activeRules.length,
      approvedTotal: approvedRules.length,
      conflictsCount: conflicts.length,
      avgDiscountPercent: (avgDiscountBps / 100).toFixed(1),
      channelsCovered
    };
  }, [rules, conflicts]);

  // Rule detail loader
  async function openRuleDetail(id: string) {
    setBusy(true);
    setError('');
    try {
      const res = await api<{ data: { promotion: PromotionRule; history: ActionHistory[] } }>(`/marketing/promotions/${id}`);
      setActiveRuleDetail(res.data);
      setReviewReason('');
      setShowDetailModal(true);
    } catch (err: any) {
      setError(err?.message || 'Could not load rule detail.');
    } finally {
      setBusy(false);
    }
  }

  // Open Create Form
  function openCreateModal() {
    setFormMode('create');
    setEditingRuleId(null);
    setFormState(emptyForm());
    setShowFormModal(true);
  }

  // Open Edit Form
  function openEditModal(rule: PromotionRule) {
    setFormMode('edit');
    setEditingRuleId(rule.id);
    setFormState({
      code: rule.promotion_code,
      name: rule.name,
      campaignId: rule.campaign_id || '',
      editionId: rule.edition_id,
      channel: rule.sales_channel,
      startDate: rule.start_date.slice(0, 10),
      endDate: rule.end_date.slice(0, 10),
      discountPercent: (Number(rule.discount_bps) / 100).toFixed(2),
      priority: String(rule.priority)
    });
    setShowFormModal(true);
  }

  // Save Rule (Create / Patch)
  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        code: formState.code.trim(),
        name: formState.name.trim(),
        campaignId: formState.campaignId ? formState.campaignId : null,
        editionId: formState.editionId,
        channel: formState.channel,
        startDate: formState.startDate,
        endDate: formState.endDate,
        discountBps: Math.round(Number(formState.discountPercent) * 100),
        priority: Number(formState.priority) || 100
      };

      if (formMode === 'create') {
        await api('/marketing/promotions', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setNotice(`Promotion rule ${payload.code} created.`);
      } else if (editingRuleId) {
        const existing = rules.find(r => r.id === editingRuleId);
        if (!existing) throw new Error('Rule not found');
        await api(`/marketing/promotions/${editingRuleId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...payload,
            version: existing.version_no
          })
        });
        setNotice(`Promotion rule ${payload.code} updated.`);
      }

      setShowFormModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save promotion rule.');
    } finally {
      setBusy(false);
    }
  }

  // Lifecycle transitions (Submit / Approve / Reject)
  async function handleTransition(status: 'submitted' | 'approved' | 'rejected') {
    if (!activeRuleDetail) return;
    const rule = activeRuleDetail.promotion;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (status === 'submitted') {
        await api(`/marketing/promotions/${rule.id}/submit`, {
          method: 'POST',
          body: JSON.stringify({ version: rule.version_no })
        });
        setNotice(`Rule ${rule.promotion_code} submitted for review.`);
      } else {
        await api(`/marketing/promotions/${rule.id}/review`, {
          method: 'POST',
          body: JSON.stringify({
            version: rule.version_no,
            status,
            reason: reviewReason || null
          })
        });
        setNotice(`Rule ${rule.promotion_code} ${status}.`);
      }
      setShowDetailModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || `Failed to set status to ${status}`);
    } finally {
      setBusy(false);
    }
  }

  const getChannelMeta = (channelId: string) => {
    return CHANNELS.find(c => c.id === channelId) || { id: channelId, label: channelId, color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            Promotion &amp; Discount Rules
          </h1>
          <p className="muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
            Manage book discounts across sales channels (Boi Mela, Retail, E-Commerce, etc.) with simple approval review.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void loadData()}
            disabled={loading || busy}
          >
            Refresh
          </button>
          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
              style={{ fontWeight: 600 }}
            >
              + New Discount Rule
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '1rem' }}>
          {notice}
        </div>
      )}

      {/* 4 Simple KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Active Rules</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>{metrics.activeNow}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{metrics.approvedTotal} approved total</div>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Scope Overlaps</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: metrics.conflictsCount > 0 ? '#e11d48' : '#0f172a', margin: '0.2rem 0' }}>
            {metrics.conflictsCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: metrics.conflictsCount > 0 ? '#e11d48' : '#16a34a' }}>
            {metrics.conflictsCount > 0 ? 'Date overlap detected' : 'Clean date windows'}
          </div>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Avg Discount Rate</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>{metrics.avgDiscountPercent}%</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Standard Fair: 25.00%</div>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Channels Covered</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>{metrics.channelsCovered} / 6</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Fair, Retail, E-com, Inst., etc.</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="panel" style={{ padding: '0.85rem 1rem', marginBottom: '1rem', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: '240px', flex: '1 1 260px' }}>
            <input
              id="simple-search-input"
              name="simpleSearch"
              type="text"
              className="input"
              placeholder="Search by code, title, book, campaign..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {(['all', 'approved', 'submitted', 'draft', 'rejected'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: statusFilter === st ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  background: statusFilter === st ? '#eff6ff' : '#ffffff',
                  color: statusFilter === st ? '#1d4ed8' : '#64748b'
                }}
              >
                {st === 'all' ? 'ALL' : st.toUpperCase()}
              </button>
            ))}
          </div>

          <div>
            <select
              id="simple-channel-select"
              name="simpleChannel"
              className="input"
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              style={{ minWidth: '160px' }}
            >
              <option value="all">All Channels</option>
              {CHANNELS.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Simple Rules Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <div className="table-wrap">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.78rem', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem' }}>RULE CODE &amp; NAME</th>
                <th style={{ padding: '0.75rem 1rem' }}>TARGET BOOK &amp; EDITION</th>
                <th style={{ padding: '0.75rem 1rem' }}>CHANNEL</th>
                <th style={{ padding: '0.75rem 1rem' }}>DISCOUNT</th>
                <th style={{ padding: '0.75rem 1rem' }}>VALID DATES</th>
                <th style={{ padding: '0.75rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    Loading rules...
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    No promotion rules found.
                  </td>
                </tr>
              ) : (
                filteredRules.map(rule => {
                  const chMeta = getChannelMeta(rule.sales_channel);
                  const discountPct = (Number(rule.discount_bps) / 100).toFixed(2);
                  const conflicting = conflicts.find(c => c.first_id === rule.id || c.second_id === rule.id);

                  return (
                    <tr key={rule.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                          {rule.promotion_code}
                        </div>
                        <div style={{ color: '#334155', fontWeight: 500, fontSize: '0.82rem' }}>
                          {rule.name}
                        </div>
                        {conflicting && (
                          <div style={{ fontSize: '0.72rem', color: '#e11d48', marginTop: '0.2rem', fontWeight: 600 }}>
                            ⚠️ Overlaps with {conflicting.first_id === rule.id ? conflicting.second_code : conflicting.first_code}
                          </div>
                        )}
                        {rule.campaign_name && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                            Campaign: {rule.campaign_name}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {rule.book_title || 'General Book'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {rule.edition_code || rule.edition_number || rule.edition_id.slice(0, 8)}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: chMeta.color,
                            background: chMeta.bg,
                            border: `1px solid ${chMeta.border}`
                          }}
                        >
                          {chMeta.label}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                        {discountPct}%
                      </td>

                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#334155' }}>
                        {rule.start_date.slice(0, 10)} to {rule.end_date.slice(0, 10)}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background:
                              rule.status === 'approved' ? '#dcfce7' :
                              rule.status === 'submitted' ? '#fef3c7' :
                              rule.status === 'rejected' ? '#fee2e2' : '#f1f5f9',
                            color:
                              rule.status === 'approved' ? '#15803d' :
                              rule.status === 'submitted' ? '#b45309' :
                              rule.status === 'rejected' ? '#b91c1c' : '#475569'
                          }}
                        >
                          {rule.status}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => openRuleDetail(rule.id)}
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                          >
                            Review
                          </button>
                          {canManage && ['draft', 'rejected'].includes(rule.status) && (
                            <button
                              type="button"
                              className="btn"
                              onClick={() => openEditModal(rule)}
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                            >
                              Edit
                            </button>
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

      {/* CREATE / EDIT MODAL */}
      {showFormModal && (
        <div className="modal-backdrop" onClick={() => setShowFormModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 580,
              width: '94%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 12,
              padding: 24,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                {formMode === 'create' ? 'New Discount Rule' : `Edit Rule: ${formState.code}`}
              </h2>
              <button
                type="button"
                className="btn"
                onClick={() => setShowFormModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="rule-code-input">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rule Code *</span>
                  <input
                    id="rule-code-input"
                    name="ruleCode"
                    type="text"
                    required
                    className="input"
                    value={formState.code}
                    disabled={formMode === 'edit'}
                    onChange={e => setFormState({ ...formState, code: e.target.value })}
                    style={{ width: '100%', fontFamily: 'monospace' }}
                  />
                </label>

                <label className="field" htmlFor="rule-name-input">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rule Name *</span>
                  <input
                    id="rule-name-input"
                    name="ruleName"
                    type="text"
                    required
                    placeholder="e.g. Boi Mela 25% Off"
                    className="input"
                    value={formState.name}
                    onChange={e => setFormState({ ...formState, name: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>

              <label className="field" htmlFor="rule-edition-select">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Target Book Edition *</span>
                <select
                  id="rule-edition-select"
                  name="ruleEdition"
                  required
                  className="input"
                  value={formState.editionId}
                  onChange={e => setFormState({ ...formState, editionId: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="">Select book edition...</option>
                  {editions.map(ed => (
                    <option key={ed.id} value={ed.id}>
                      {ed.book_title || 'Untitled Book'} ({ed.edition_code || ed.edition_number})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="rule-channel-select">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sales Channel *</span>
                  <select
                    id="rule-channel-select"
                    name="ruleChannel"
                    required
                    className="input"
                    value={formState.channel}
                    onChange={e => setFormState({ ...formState, channel: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {CHANNELS.map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="rule-discount-input">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Discount (%) *</span>
                  <input
                    id="rule-discount-input"
                    name="ruleDiscount"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    required
                    className="input"
                    value={formState.discountPercent}
                    onChange={e => setFormState({ ...formState, discountPercent: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="rule-start-input">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Start Date *</span>
                  <input
                    id="rule-start-input"
                    name="ruleStart"
                    type="date"
                    required
                    className="input"
                    value={formState.startDate}
                    onChange={e => setFormState({ ...formState, startDate: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>

                <label className="field" htmlFor="rule-end-input">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>End Date *</span>
                  <input
                    id="rule-end-input"
                    name="ruleEnd"
                    type="date"
                    required
                    className="input"
                    value={formState.endDate}
                    onChange={e => setFormState({ ...formState, endDate: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>

              <label className="field" htmlFor="rule-campaign-select">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Linked Campaign (Optional)</span>
                <select
                  id="rule-campaign-select"
                  name="ruleCampaign"
                  className="input"
                  value={formState.campaignId}
                  onChange={e => setFormState({ ...formState, campaignId: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="">No campaign (Standalone)</option>
                  {campaigns.map(camp => (
                    <option key={camp.id} value={camp.id}>
                      {camp.campaign_code} &bull; {camp.name}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowFormModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !formState.code || !formState.name || !formState.editionId || !formState.startDate || !formState.endDate}
                >
                  {busy ? 'Saving...' : formMode === 'create' ? 'Create Rule' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW & GOVERNANCE MODAL */}
      {showDetailModal && activeRuleDetail && (
        <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 580,
              width: '94%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 12,
              padding: 24,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem' }}>
                    {activeRuleDetail.promotion.promotion_code}
                  </span>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background:
                        activeRuleDetail.promotion.status === 'approved' ? '#dcfce7' :
                        activeRuleDetail.promotion.status === 'submitted' ? '#fef3c7' :
                        activeRuleDetail.promotion.status === 'rejected' ? '#fee2e2' : '#f1f5f9',
                      color:
                        activeRuleDetail.promotion.status === 'approved' ? '#15803d' :
                        activeRuleDetail.promotion.status === 'submitted' ? '#b45309' :
                        activeRuleDetail.promotion.status === 'rejected' ? '#b91c1c' : '#475569'
                    }}
                  >
                    {activeRuleDetail.promotion.status}
                  </span>
                </div>
                <div style={{ fontWeight: 600, color: '#334155', marginTop: 2 }}>
                  {activeRuleDetail.promotion.name}
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => setShowDetailModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>

            {/* Summary */}
            <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14, fontSize: '0.85rem' }}>
              <div>Book: <strong>{activeRuleDetail.promotion.book_title || 'General Title'}</strong> ({activeRuleDetail.promotion.edition_code || activeRuleDetail.promotion.edition_number})</div>
              <div style={{ marginTop: 4 }}>Channel: <strong>{getChannelMeta(activeRuleDetail.promotion.sales_channel).label}</strong></div>
              <div style={{ marginTop: 4 }}>Discount: <strong style={{ color: '#2563eb' }}>{(Number(activeRuleDetail.promotion.discount_bps) / 100).toFixed(2)}%</strong></div>
              <div style={{ marginTop: 4 }}>Dates: <strong>{activeRuleDetail.promotion.start_date.slice(0, 10)} to {activeRuleDetail.promotion.end_date.slice(0, 10)}</strong></div>
            </div>

            {/* Decision note */}
            <label className="field" htmlFor="review-reason-text">
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Reviewer Note / Justification</span>
              <textarea
                id="review-reason-text"
                name="reviewReason"
                rows={2}
                className="input"
                placeholder="Enter approval note or rejection reason..."
                value={reviewReason}
                onChange={e => setReviewReason(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </label>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              {canManage && ['draft', 'rejected'].includes(activeRuleDetail.promotion.status) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void handleTransition('submitted')}
                >
                  Submit for Approval
                </button>
              )}

              {canApprove && activeRuleDetail.promotion.status === 'submitted' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void handleTransition('approved')}
                    style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  >
                    Approve Rule
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !reviewReason.trim()}
                    onClick={() => void handleTransition('rejected')}
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    Reject
                  </button>
                </>
              )}
            </div>

            {/* Audit log */}
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                Audit History
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '130px', overflowY: 'auto' }}>
                {activeRuleDetail.history.map((h, i) => (
                  <div key={`${h.occurred_at}-${i}`} style={{ fontSize: '0.75rem', color: '#475569', background: '#f8fafc', padding: '0.35rem 0.5rem', borderRadius: 4 }}>
                    <strong>{h.actor_name}</strong>: {h.action} ({h.from_status || 'new'} &rarr; {h.to_status}) at {h.occurred_at.slice(0, 16).replace('T', ' ')}
                    {h.reason && <span> &bull; <em>"{h.reason}"</em></span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
