"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Plus,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Download,
  ExternalLink,
  Eye,
  RefreshCw,
  X,
  BookOpen,
  Tag,
  Building,
  User,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

export type Campaign = {
  id: string;
  campaign_code: string;
  name: string;
  campaign_type: string;
  objective: string;
  description: string | null;
  primary_channel: string;
  timezone: string;
  start_date: string;
  end_date: string;
  owner_id: string;
  owner_name?: string;
  book_id: string | null;
  edition_id: string | null;
  book_title?: string | null;
  edition_code?: string | null;
  planned_budget: string;
  target_leads: number | null;
  status: string;
  version_no: number;
  created_by: string;
};

type CampaignSummary = {
  total_campaigns: number;
  total_budget: string | number;
  total_target_leads: number;
  active_scheduled_count: number;
  pending_approval_count: number;
  approved_count: number;
  draft_count: number;
  completed_count: number;
  cancelled_count: number;
};

type HistoryItem = {
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  actor_name: string;
  occurred_at: string;
};

function formatMoney(amount: number | string | undefined | null): string {
  if (amount == null) return '0.00';
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return dateStr.slice(0, 10);
}

const CAMPAIGN_STATUSES = [
  { key: 'all', label: 'All Statuses' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted (In Review)' },
  { key: 'approved', label: 'Approved' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const CHANNELS = [
  { key: 'all', label: 'All Channels', icon: '🌐' },
  { key: 'retail', label: 'Retail Stores', icon: '🏪' },
  { key: 'wholesale', label: 'Wholesale', icon: '📦' },
  { key: 'distributor', label: 'Distributor', icon: '🚚' },
  { key: 'institutional', label: 'Institutional / Schools', icon: '🏫' },
  { key: 'ecommerce', label: 'E-commerce', icon: '🛒' },
  { key: 'book_fair', label: 'Book Fair / Boi Mela', icon: '🎪' },
  { key: 'social', label: 'Social & Digital Ads', icon: '📱' },
  { key: 'email', label: 'Email Newsletter', icon: '✉️' },
  { key: 'offline', label: 'Offline / Event', icon: '📢' },
];

export function CampaignListScreen({ screen }: { screen: Screen }) {
  const [mounted, setMounted] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'budget_desc' | 'name_asc'>('date_desc');

  // Detail & Drawer
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignHistory, setCampaignHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // User auth state
  const [me, setMe] = useState<{ userId: string; role: string; permissions: string[] } | null>(null);
  const canManage = me?.role === 'Owner' || Boolean(me?.permissions.includes('marketing.manage'));
  const canApprove = me?.role === 'Owner' || Boolean(me?.permissions.includes('marketing.approve'));

  useEffect(() => {
    setMounted(true);
    void api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me')
      .then(res => setMe(res.data))
      .catch(() => {});
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (search.trim()) params.set('q', search.trim());
      if (selectedStatus !== 'all') params.set('status', selectedStatus);

      const [campaignsRes, summaryRes] = await Promise.all([
        api<{ data: Campaign[]; meta: { total: number } }>(`/marketing/campaigns?${params}`),
        api<{ data: { summary: CampaignSummary } }>(`/marketing/campaigns/summary`).catch(() => ({ data: { summary: {} as CampaignSummary } })),
      ]);

      setCampaigns(campaignsRes.data || []);
      setTotalCount(campaignsRes.meta?.total || 0);
      if (summaryRes.data?.summary) {
        setSummary(summaryRes.data.summary);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Could not load marketing campaigns');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mounted) {
      void loadData();
    }
  }, [mounted, page, selectedStatus]);

  async function openCampaignDetail(camp: Campaign) {
    setSelectedCampaign(camp);
    setDecisionReason('');
    setLoadingHistory(true);
    try {
      const res = await api<{ data: { campaign: Campaign; history: HistoryItem[] } }>(`/marketing/campaigns/${camp.id}`);
      setSelectedCampaign(res.data.campaign);
      setCampaignHistory(res.data.history || []);
    } catch (err) {
      // fallback to current row
    } finally {
      setLoadingHistory(false);
    }
  }

  async function executeTransition(nextStatus: string) {
    if (!selectedCampaign) return;
    setActionBusy(true);
    setError('');
    setNotice('');
    try {
      const isReview = ['approved', 'rejected'].includes(nextStatus);
      const endpoint = `/marketing/campaigns/${selectedCampaign.id}/${isReview ? 'review' : 'transition'}`;
      await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          version: selectedCampaign.version_no,
          status: nextStatus,
          reason: decisionReason || null,
        }),
      });

      setNotice(`Campaign ${selectedCampaign.campaign_code} moved to ${nextStatus.toUpperCase()}`);
      setDecisionReason('');
      await loadData();
      await openCampaignDetail(selectedCampaign);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Lifecycle action failed');
    } finally {
      setActionBusy(false);
    }
  }

  // Filtered rows (in case channel filter is applied client-side)
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];
    if (selectedChannel !== 'all') {
      result = result.filter(c => c.primary_channel === selectedChannel);
    }
    if (sortBy === 'date_desc') {
      result.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
    } else if (sortBy === 'date_asc') {
      result.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
    } else if (sortBy === 'budget_desc') {
      result.sort((a, b) => (parseFloat(b.planned_budget) || 0) - (parseFloat(a.planned_budget) || 0));
    } else if (sortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [campaigns, selectedChannel, sortBy]);

  function exportCsv() {
    if (!filteredCampaigns.length) return;
    const headers = ['Campaign Code', 'Campaign Name', 'Type', 'Channel', 'Target Book', 'Start Date', 'End Date', 'Owner', 'Planned Budget (BDT)', 'Target Leads', 'Status'];
    const rows = filteredCampaigns.map(c => [
      c.campaign_code,
      `"${c.name.replace(/"/g, '""')}"`,
      c.campaign_type,
      c.primary_channel,
      `"${(c.book_title || 'Brand').replace(/"/g, '""')}"`,
      formatDate(c.start_date),
      formatDate(c.end_date),
      `"${(c.owner_name || '').replace(/"/g, '""')}"`,
      c.planned_budget,
      c.target_leads ?? '',
      c.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `marketing_campaigns_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{ padding: '0 4px 40px 4px', display: 'flex', flexDirection: 'column', gap: 20 }} suppressHydrationWarning>
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
              <Megaphone size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Marketing Campaign List
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Manage title launch campaigns, fair promotional drives, channel marketing, and budget pipelines.
              </p>
            </div>
          </div>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadData()}
            title="Refresh campaigns list"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            href="/marketing-promotions/release-calendar"
            className="btn btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff' }}
          >
            <Calendar size={14} />
            <span>Release Calendar</span>
          </Link>

          <Link
            href="/marketing-promotions/campaign-budget-approval"
            className="btn btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff' }}
          >
            <DollarSign size={14} />
            <span>Budget Approvals</span>
          </Link>

          <button
            type="button"
            className="btn btn-sm"
            onClick={exportCsv}
            disabled={!filteredCampaigns.length}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff' }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <Link
            href="/marketing-promotions/create-campaign"
            className="btn btn-sm btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={15} />
            <span>+ Create Campaign</span>
          </Link>
        </div>
      </div>

      {/* NOTICES & ALERTS */}
      {error && (
        <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* 4 TOP EXECUTIVE KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* Card 1: Total Campaigns */}
        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Campaigns
            </span>
            <div style={{ background: '#eff6ff', color: '#2563eb', padding: 6, borderRadius: 8 }}>
              <Megaphone size={16} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
            {summary?.total_campaigns ?? totalCount}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Registered promotional drives in ERP
          </div>
        </div>

        {/* Card 2: Active & Scheduled */}
        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active & Scheduled
            </span>
            <div style={{ background: '#dcfce7', color: '#16a34a', padding: 6, borderRadius: 8 }}>
              <Sparkles size={16} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#15803d' }}>
            {summary?.active_scheduled_count ?? 0}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Live or scheduled for upcoming launch
          </div>
        </div>

        {/* Card 3: Total Planned Budget */}
        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #ffffff 0%, #fefce8 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Planned Budget
            </span>
            <div style={{ background: '#fef9c3', color: '#ca8a04', padding: 6, borderRadius: 8 }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#a16207' }}>
            ৳{formatMoney(summary?.total_budget || 0)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Allocated marketing investments
          </div>
        </div>

        {/* Card 4: Pending Approval */}
        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Approvals
            </span>
            <div style={{ background: '#f3e8ff', color: '#9333ea', padding: 6, borderRadius: 8 }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#7e22ce' }}>
            {summary?.pending_approval_count ?? 0}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Campaign plans submitted for review
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS CONTROLS */}
      <div
        className="panel"
        style={{
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Row 1: Search, Channel Select, Sort By */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              id="campaign-search-input"
              name="campaign_search"
              aria-label="Search campaigns"
              className="input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setPage(0);
                  void loadData();
                }
              }}
              placeholder="Search by campaign code, name, or book title..."
              style={{ paddingLeft: 34, height: 38, width: '100%' }}
            />
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => {
              setPage(0);
              void loadData();
            }}
            style={{ height: 38, paddingLeft: 16, paddingRight: 16 }}
          >
            Search
          </button>

          {/* Channel Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="campaign-channel-select" style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Channel:</label>
            <select
              id="campaign-channel-select"
              name="channel"
              aria-label="Filter by marketing channel"
              className="input"
              value={selectedChannel}
              onChange={e => setSelectedChannel(e.target.value)}
              style={{ height: 38, fontSize: 12.5 }}
            >
              {CHANNELS.map(ch => (
                <option key={ch.key} value={ch.key}>
                  {ch.icon} {ch.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="campaign-sort-select" style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Sort:</label>
            <select
              id="campaign-sort-select"
              name="sort"
              aria-label="Sort campaigns"
              className="input"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{ height: 38, fontSize: 12.5 }}
            >
              <option value="date_desc">Start Date (Newest first)</option>
              <option value="date_asc">Start Date (Oldest first)</option>
              <option value="budget_desc">Budget (Highest first)</option>
              <option value="name_asc">Campaign Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Status Quick-Filter Chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginRight: 4 }}>Status:</span>
          {CAMPAIGN_STATUSES.map(st => {
            const isSelected = selectedStatus === st.key;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => {
                  setPage(0);
                  setSelectedStatus(st.key);
                }}
                style={{
                  border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  background: isSelected ? '#eff6ff' : '#ffffff',
                  color: isSelected ? '#1d4ed8' : '#475569',
                  borderRadius: 20,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CAMPAIGN LIST DATA TABLE */}
      <div
        className="panel"
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase' }}>Campaign & Code</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase' }}>Channel</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase' }}>Target Book</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase' }}>Duration</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase' }}>Planned Budget</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase' }}>Owner</th>
                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    Loading campaigns...
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <Megaphone size={32} style={{ color: '#cbd5e1' }} />
                      <div style={{ fontWeight: 700, color: '#334155' }}>No campaigns found matching criteria.</div>
                      <div style={{ fontSize: 12 }}>Try adjusting your search query, status, or channel filter.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map(camp => {
                  const isSubmitted = camp.status === 'submitted';
                  const isApproved = camp.status === 'approved';
                  const isScheduled = camp.status === 'scheduled';
                  const isActive = camp.status === 'active';
                  const isDraft = camp.status === 'draft';
                  const isCompleted = camp.status === 'completed';
                  const isCancelled = camp.status === 'cancelled';

                  let statusBg = '#f1f5f9';
                  let statusColor = '#475569';
                  let statusBorder = '#e2e8f0';

                  if (isSubmitted) {
                    statusBg = '#eff6ff';
                    statusColor = '#1d4ed8';
                    statusBorder = '#bfdbfe';
                  } else if (isApproved) {
                    statusBg = '#fef3c7';
                    statusColor = '#b45309';
                    statusBorder = '#fde68a';
                  } else if (isScheduled) {
                    statusBg = '#f5f3ff';
                    statusColor = '#6d28d9';
                    statusBorder = '#ddd6fe';
                  } else if (isActive) {
                    statusBg = '#dcfce7';
                    statusColor = '#15803d';
                    statusBorder = '#bbf7d0';
                  } else if (isCompleted) {
                    statusBg = '#ecfdf5';
                    statusColor = '#047857';
                    statusBorder = '#a7f3d0';
                  } else if (isCancelled) {
                    statusBg = '#fee2e2';
                    statusColor = '#b91c1c';
                    statusBorder = '#fecaca';
                  }

                  // Channel badge info
                  const channelInfo = CHANNELS.find(c => c.key === camp.primary_channel) || { label: camp.primary_channel, icon: '📢' };

                  return (
                    <tr
                      key={camp.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.1s ease',
                        cursor: 'pointer',
                      }}
                      onClick={() => void openCampaignDetail(camp)}
                      className="hover:bg-slate-50"
                    >
                      {/* Campaign Code & Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
                          {camp.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', background: '#f8fafc', padding: '1px 5px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                            {camp.campaign_code}
                          </span>
                        </div>
                      </td>

                      {/* Campaign Type */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11.5, background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                          {camp.campaign_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>

                      {/* Primary Channel */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                          <span>{channelInfo.icon}</span>
                          <span>{channelInfo.label}</span>
                        </span>
                      </td>

                      {/* Target Book */}
                      <td style={{ padding: '12px 14px' }}>
                        {camp.book_title ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <BookOpen size={13} style={{ color: '#2563eb', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#1d4ed8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={camp.book_title}>
                              {camp.book_title}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Brand / Catalog</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#334155' }}>
                        <div>{formatDate(camp.start_date)}</div>
                        <div style={{ color: '#64748b', fontSize: 11 }}>to {formatDate(camp.end_date)}</div>
                      </td>

                      {/* Planned Budget */}
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                        ৳{formatMoney(camp.planned_budget)}
                      </td>

                      {/* Owner */}
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#475569' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={12} style={{ color: '#94a3b8' }} />
                          <span>{camp.owner_name || 'Unassigned'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: statusBg,
                            color: statusColor,
                            border: `1px solid ${statusBorder}`,
                            textTransform: 'uppercase',
                          }}
                        >
                          {camp.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => void openCampaignDetail(camp)}
                            style={{ padding: '4px 8px', fontSize: 11.5 }}
                          >
                            <Eye size={13} style={{ marginRight: 4 }} />
                            Review
                          </button>
                          <Link
                            href={`/marketing-promotions/create-campaign?campaign=${camp.id}`}
                            className="btn btn-sm"
                            style={{ padding: '4px 8px', fontSize: 11.5, background: '#ffffff' }}
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12.5,
            color: '#64748b',
          }}
        >
          <div>
            Showing <strong>{filteredCampaigns.length}</strong> of <strong>{totalCount}</strong> campaigns
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span>
              Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={(page + 1) * pageSize >= totalCount}
              onClick={() => setPage(page + 1)}
              style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* CAMPAIGN DETAIL & LIFECYCLE MODAL / DRAWER */}
      {selectedCampaign && (
        <div className="modal-backdrop" onClick={() => setSelectedCampaign(null)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 750,
              width: '94%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 16,
              padding: 28,
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.08)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', textTransform: 'uppercase' }}>
                    {selectedCampaign.campaign_type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                    {selectedCampaign.campaign_code}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#f1f5f9', color: '#334155', textTransform: 'uppercase' }}>
                    {selectedCampaign.status}
                  </span>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: '6px 0 0', color: '#0f172a' }}>
                  {selectedCampaign.name}
                </h2>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setSelectedCampaign(null)}
                style={{ padding: '6px 8px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Channel</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {selectedCampaign.primary_channel.toUpperCase()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Planned Budget</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d', marginTop: 2 }}>
                  ৳{formatMoney(selectedCampaign.planned_budget)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Campaign Window</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                  {formatDate(selectedCampaign.start_date)} to {formatDate(selectedCampaign.end_date)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Target Leads</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {selectedCampaign.target_leads != null ? selectedCampaign.target_leads : 'Not set'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Assigned Owner</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                  {selectedCampaign.owner_name || 'Unassigned'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Target Book</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', marginTop: 2 }}>
                  {selectedCampaign.book_title || 'General Brand Campaign'}
                </div>
              </div>
            </div>

            {/* Objective & Description */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Campaign Objective
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#1e293b', lineHeight: 1.5 }}>
                {selectedCampaign.objective}
              </p>
              {selectedCampaign.description && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                    Operational Description
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
                    {selectedCampaign.description}
                  </p>
                </div>
              )}
            </div>

            {/* LIFECYCLE DECISION / ACTION PANEL */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={15} style={{ color: '#2563eb' }} />
                <span>Lifecycle & Governance Controls</span>
              </div>

              {/* Decision Reason Input */}
              {['submitted', 'draft', 'rejected', 'approved', 'scheduled'].includes(selectedCampaign.status) && (
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="decision-reason-input" style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                    Decision Reason / Comments (required for Rejection or Cancellation):
                  </label>
                  <input
                    id="decision-reason-input"
                    name="decision_reason"
                    aria-label="Decision reason or audit justification"
                    className="input"
                    value={decisionReason}
                    onChange={e => setDecisionReason(e.target.value)}
                    placeholder="Enter approval note, audit justification, or rejection reason..."
                    style={{ width: '100%', height: 36, fontSize: 12.5 }}
                  />
                </div>
              )}

              {/* Action Buttons based on status & permissions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canManage && ['draft', 'rejected'].includes(selectedCampaign.status) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={actionBusy}
                    onClick={() => void executeTransition('submitted')}
                  >
                    Submit for Budget Approval
                  </button>
                )}

                {canApprove && selectedCampaign.status === 'submitted' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={actionBusy}
                      onClick={() => void executeTransition('approved')}
                      style={{ background: '#16a34a', borderColor: '#16a34a' }}
                    >
                      ✓ Approve Plan & Budget
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={actionBusy || !decisionReason.trim()}
                      onClick={() => void executeTransition('rejected')}
                      style={{ color: '#dc2626' }}
                    >
                      Reject Plan
                    </button>
                  </>
                )}

                {canManage && selectedCampaign.status === 'approved' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={actionBusy}
                    onClick={() => void executeTransition('scheduled')}
                  >
                    Mark Scheduled
                  </button>
                )}

                {canManage && ['draft', 'rejected', 'approved', 'scheduled'].includes(selectedCampaign.status) && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={actionBusy || !decisionReason.trim()}
                    onClick={() => void executeTransition('cancelled')}
                    style={{ color: '#64748b' }}
                  >
                    Cancel Campaign
                  </button>
                )}

                {/* Cross-Module Links */}
                <Link
                  href={`/marketing-promotions/promotion-and-discount-rules?campaign=${selectedCampaign.id}`}
                  className="btn btn-sm"
                  style={{ background: '#ffffff', fontSize: 11.5 }}
                >
                  <Tag size={13} style={{ marginRight: 4 }} />
                  Create Discount Rule
                </Link>

                <Link
                  href={`/marketing-promotions/create-campaign?campaign=${selectedCampaign.id}`}
                  className="btn btn-sm"
                  style={{ background: '#ffffff', fontSize: 11.5 }}
                >
                  Edit Plan
                </Link>
              </div>
            </div>

            {/* AUDIT / APPROVAL TIMELINE */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                Approval & Audit Timeline
              </div>
              {loadingHistory ? (
                <div style={{ fontSize: 12, color: '#64748b' }}>Loading timeline...</div>
              ) : campaignHistory.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No recorded timeline actions yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {campaignHistory.map((h, i) => (
                    <div
                      key={`${h.occurred_at}-${i}`}
                      style={{
                        padding: '8px 12px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{h.action}</span>
                        <span style={{ color: '#64748b', marginLeft: 6 }}>
                          ({h.from_status || 'new'} → {h.to_status || '—'})
                        </span>
                        {h.reason && (
                          <div style={{ color: '#475569', fontSize: 11.5, marginTop: 2 }}>
                            Reason: "{h.reason}"
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
                        <div>{h.actor_name}</div>
                        <div>{h.occurred_at.slice(0, 19).replace('T', ' ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
