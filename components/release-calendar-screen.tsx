"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  BookOpen,
  Megaphone,
  Store,
  Layers,
  Clock,
  MapPin,
  Tag,
  DollarSign,
  Download,
  ExternalLink,
  X,
  RefreshCw,
  LayoutGrid,
  List,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

export type CalendarRelease = {
  id: string;
  kind: 'book';
  code: string;
  title: string;
  subtitle?: string | null;
  categoryName?: string | null;
  editionCode?: string | null;
  format?: string;
  startDate: string;
  endDate: string;
  status: string;
  targetAudience?: string | null;
  language?: string;
};

export type CalendarCampaign = {
  id: string;
  kind: 'campaign';
  code: string;
  title: string;
  campaignType: string;
  primaryChannel: string;
  startDate: string;
  endDate: string;
  status: string;
  plannedBudget: number;
  targetLeads?: number | null;
  objective?: string;
  description?: string | null;
  bookTitle?: string | null;
  ownerName?: string | null;
};

export type CalendarFair = {
  id: string;
  kind: 'fair';
  code: string;
  title: string;
  eventType: string;
  venue: string;
  city?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  salesTarget: number;
  budgetAmount: number;
  boothCount: number;
};

export type CalendarItem = CalendarRelease | CalendarCampaign | CalendarFair;

export type CalendarOverviewResponse = {
  window: { from: string; to: string };
  kpis: {
    releasesThisMonth: number;
    activeCampaigns: number;
    upcomingFairs: number;
    pipelineTitles: number;
  };
  releases: CalendarRelease[];
  campaigns: CalendarCampaign[];
  fairs: CalendarFair[];
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday (0) to 6, Monday (1) to 0
  return day === 0 ? 6 : day - 1;
}

export function ReleaseCalendarScreen({ screen }: { screen: Screen }) {
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'timeline' | 'agenda' | 'table'>('month');
  const [typeFilter, setTypeFilter] = useState<'all' | 'book' | 'campaign' | 'fair'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<CalendarOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [selectedDayModal, setSelectedDayModal] = useState<{ dateStr: string; items: CalendarItem[] } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      // Calculate window: from 1 month before to 2 months after current displayed month
      const from = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const to = new Date(year, month + 3, 0).toISOString().split('T')[0];
      const res = await api<{ data: CalendarOverviewResponse }>(
        `/marketing/calendar/overview?from=${from}&to=${to}`
      );
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load release calendar data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mounted) {
      void loadData();
    }
  }, [mounted, year, month]);

  const allItems: CalendarItem[] = useMemo(() => {
    if (!data) return [];
    return [...data.releases, ...data.campaigns, ...data.fairs];
  }, [data]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(q);
        const codeMatch = item.code.toLowerCase().includes(q);
        const dateMatch = item.startDate.includes(q) || item.endDate.includes(q);
        const extraMatch =
          item.kind === 'book'
            ? item.categoryName?.toLowerCase().includes(q)
            : item.kind === 'campaign'
            ? item.primaryChannel?.toLowerCase().includes(q) || item.bookTitle?.toLowerCase().includes(q)
            : item.venue?.toLowerCase().includes(q) || item.city?.toLowerCase().includes(q);
        if (!titleMatch && !codeMatch && !dateMatch && !extraMatch) return false;
      }
      return true;
    });
  }, [allItems, typeFilter, statusFilter, search]);

  // Calendar cells for Month view
  const calendarCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      items: CalendarItem[];
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = prevDate.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        items: filteredItems.filter(item => item.startDate === dateStr),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = curDate.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        items: filteredItems.filter(item => {
          // Releases usually match startDate exactly; campaigns/fairs span range
          if (item.kind === 'book') return item.startDate === dateStr;
          return item.startDate <= dateStr && item.endDate >= dateStr;
        }),
      });
    }

    // Next month filler days to complete grid (up to 35 or 42 cells)
    const totalFilled = cells.length;
    const remaining = totalFilled <= 35 ? 35 - totalFilled : 42 - totalFilled;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        items: filteredItems.filter(item => item.startDate === dateStr),
      });
    }

    return cells;
  }, [year, month, filteredItems]);

  // Sorted items for timeline & agenda
  const timelineItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [filteredItems]);

  function handlePrevMonth() {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  function exportIcs(item: CalendarItem) {
    const start = item.startDate.replaceAll('-', '');
    const end = (item.endDate || item.startDate).replaceAll('-', '');
    const desc =
      item.kind === 'book'
        ? `Book Launch: ${item.title} (${item.code}). Format: ${item.format || 'Paperback'}.`
        : item.kind === 'campaign'
        ? `Marketing Campaign: ${item.title} (${item.code}). Channel: ${item.primaryChannel}. Budget: ৳${formatMoney(item.plannedBudget)}.`
        : `Book Fair / Exhibition: ${item.title} at ${item.venue}, ${item.city || 'Bangladesh'}.`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Publishing ERP//Release Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${item.id}@publishingerp.com`,
      `DTSTAMP:${start}T000000Z`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${item.title}`,
      `DESCRIPTION:${desc.replaceAll('\n', ' ')}`,
      item.kind === 'fair' ? `LOCATION:${item.venue}, ${item.city || ''}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${item.code || 'release'}-schedule.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (!mounted) {
    return (
      <div style={{ minHeight: 450, padding: '24px 0' }} suppressHydrationWarning>
        <div className="page-heading" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>📅</span> {screen.title}
            </h1>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              Loading release calendar workspace...
            </p>
          </div>
        </div>
        <div className="panel" style={{ padding: 40, textAlign: 'center', color: '#64748b', borderRadius: 12 }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block', color: '#3b82f6' }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Initializing calendar pipeline...</span>
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-heading" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📅</span> Release Calendar &amp; Launch Pipeline
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Synchronized publication release dates, marketing campaign windows, and Amar Ekushey Boi Mela literary premiere schedules.
          </p>
        </div>

        <div className="button-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            className="btn btn-primary"
            href="/marketing-promotions/create-campaign"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Megaphone size={14} />
            <span>New Campaign</span>
          </Link>
          <Link
            className="btn"
            href="/book-fair-events/fair-setup-and-booth"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Store size={14} />
            <span>Fair Schedules</span>
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => void loadData()}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            title="Refresh calendar"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      {/* 4 Top KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            borderLeft: '4px solid #2563eb',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={14} /> Releases This Month
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
            {data?.kpis.releasesThisMonth ?? 0} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>titles</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
            Scheduled for publication rollout
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            borderLeft: '4px solid #7c3aed',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Megaphone size={14} /> Active Campaigns
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#6d28d9', marginTop: 4 }}>
            {data?.kpis.activeCampaigns ?? 0} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>active</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
            Promotional &amp; digital marketing drives
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            borderLeft: '4px solid #d97706',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Store size={14} /> Fair Premieres
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#b45309', marginTop: 4 }}>
            {data?.kpis.upcomingFairs ?? 0} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>events</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
            Boi Mela &amp; regional book fairs
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            borderLeft: '4px solid #059669',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={14} /> Pipeline Titles
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#047857', marginTop: 4 }}>
            {data?.kpis.pipelineTitles ?? 0} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>in-pipeline</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
            In editorial, review &amp; pre-press
          </div>
        </div>
      </div>

      {/* Main Workspace Panel */}
      <div className="panel" style={{ padding: '20px 22px', borderRadius: 14 }}>
        {/* Navigation & Toolbar Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 18,
            paddingBottom: 16,
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          {/* Month Navigation & Today */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', minWidth: 180, textAlign: 'center' }}>
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleNextMonth}
              title="Next Month"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={handleToday}
              style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: '#2563eb', borderColor: '#bfdbfe' }}
            >
              Today
            </button>
          </div>

          {/* View Mode Switcher */}
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setViewMode('month')}
              style={{
                border: 'none',
                background: viewMode === 'month' ? '#ffffff' : 'transparent',
                color: viewMode === 'month' ? '#1d4ed8' : '#64748b',
                fontWeight: viewMode === 'month' ? 700 : 500,
                boxShadow: viewMode === 'month' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
              }}
            >
              <LayoutGrid size={13} />
              <span>Month Grid</span>
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setViewMode('timeline')}
              style={{
                border: 'none',
                background: viewMode === 'timeline' ? '#ffffff' : 'transparent',
                color: viewMode === 'timeline' ? '#1d4ed8' : '#64748b',
                fontWeight: viewMode === 'timeline' ? 700 : 500,
                boxShadow: viewMode === 'timeline' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
              }}
            >
              <GitCommit size={13} />
              <span>Milestones</span>
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setViewMode('agenda')}
              style={{
                border: 'none',
                background: viewMode === 'agenda' ? '#ffffff' : 'transparent',
                color: viewMode === 'agenda' ? '#1d4ed8' : '#64748b',
                fontWeight: viewMode === 'agenda' ? 700 : 500,
                boxShadow: viewMode === 'agenda' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
              }}
            >
              <Clock size={13} />
              <span>Agenda</span>
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setViewMode('table')}
              style={{
                border: 'none',
                background: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? '#1d4ed8' : '#64748b',
                fontWeight: viewMode === 'table' ? 700 : 500,
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
              }}
            >
              <List size={13} />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
            <input
              id="release-calendar-search"
              name="search"
              className="input"
              style={{ paddingLeft: 30, fontSize: 12.5 }}
              placeholder="Search title, SKU, author, or campaign..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Quick Type Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginRight: 4 }}>
              Filter:
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setTypeFilter('all')}
              style={{
                fontSize: 11.5,
                padding: '4px 10px',
                borderRadius: 20,
                background: typeFilter === 'all' ? '#1e293b' : '#f8fafc',
                color: typeFilter === 'all' ? '#ffffff' : '#475569',
                borderColor: typeFilter === 'all' ? '#1e293b' : '#e2e8f0',
                fontWeight: typeFilter === 'all' ? 700 : 500,
              }}
            >
              All Types ({allItems.length})
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setTypeFilter('book')}
              style={{
                fontSize: 11.5,
                padding: '4px 10px',
                borderRadius: 20,
                background: typeFilter === 'book' ? '#eff6ff' : '#f8fafc',
                color: typeFilter === 'book' ? '#1d4ed8' : '#475569',
                borderColor: typeFilter === 'book' ? '#3b82f6' : '#e2e8f0',
                fontWeight: typeFilter === 'book' ? 700 : 500,
              }}
            >
              📘 Books ({data?.releases.length ?? 0})
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setTypeFilter('campaign')}
              style={{
                fontSize: 11.5,
                padding: '4px 10px',
                borderRadius: 20,
                background: typeFilter === 'campaign' ? '#f5f3ff' : '#f8fafc',
                color: typeFilter === 'campaign' ? '#6d28d9' : '#475569',
                borderColor: typeFilter === 'campaign' ? '#8b5cf6' : '#e2e8f0',
                fontWeight: typeFilter === 'campaign' ? 700 : 500,
              }}
            >
              🚀 Campaigns ({data?.campaigns.length ?? 0})
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setTypeFilter('fair')}
              style={{
                fontSize: 11.5,
                padding: '4px 10px',
                borderRadius: 20,
                background: typeFilter === 'fair' ? '#fffbeb' : '#f8fafc',
                color: typeFilter === 'fair' ? '#b45309' : '#475569',
                borderColor: typeFilter === 'fair' ? '#f59e0b' : '#e2e8f0',
                fontWeight: typeFilter === 'fair' ? 700 : 500,
              }}
            >
              🎪 Fairs ({data?.fairs.length ?? 0})
            </button>

            {/* Status Selector */}
            <select
              id="release-status-filter"
              name="statusFilter"
              className="input"
              style={{ fontSize: 11.5, padding: '4px 8px', height: 32, marginLeft: 6 }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="published">Published</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* VIEW 1: INTERACTIVE MONTH GRID */}
        {viewMode === 'month' && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            {/* Days of Week Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 12,
                color: '#475569',
                padding: '10px 0',
              }}
            >
              {DAY_NAMES.map(day => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Calendar Cells Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                background: '#e2e8f0',
                gap: 1,
              }}
            >
              {calendarCells.map((cell, idx) => (
                <div
                  key={`${cell.dateStr}-${idx}`}
                  onClick={() => {
                    if (cell.items.length > 0) {
                      setSelectedDayModal({ dateStr: cell.dateStr, items: cell.items });
                    }
                  }}
                  style={{
                    minHeight: 110,
                    background: cell.isCurrentMonth ? '#ffffff' : '#f8fafc',
                    padding: '8px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    cursor: cell.items.length > 0 ? 'pointer' : 'default',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Date number */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: cell.isToday ? 800 : cell.isCurrentMonth ? 600 : 400,
                        color: cell.isToday ? '#ffffff' : cell.isCurrentMonth ? '#0f172a' : '#94a3b8',
                        background: cell.isToday ? '#2563eb' : 'transparent',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {cell.dayNum}
                    </span>
                    {cell.items.length > 0 && (
                      <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                        {cell.items.length} {cell.items.length === 1 ? 'event' : 'events'}
                      </span>
                    )}
                  </div>

                  {/* Event Chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
                    {cell.items.slice(0, 3).map(item => {
                      const isBook = item.kind === 'book';
                      const isFair = item.kind === 'fair';
                      const bg = isBook ? '#eff6ff' : isFair ? '#fffbeb' : '#f5f3ff';
                      const color = isBook ? '#1d4ed8' : isFair ? '#b45309' : '#6d28d9';
                      const border = isBook ? '#bfdbfe' : isFair ? '#fde68a' : '#ddd6fe';

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                          style={{
                            border: `1px solid ${border}`,
                            background: bg,
                            color: color,
                            borderRadius: 4,
                            padding: '2px 5px',
                            fontSize: 10.5,
                            fontWeight: 600,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            width: '100%',
                          }}
                          title={`${item.title} (${item.code})`}
                        >
                          <span style={{ flexShrink: 0 }}>
                            {isBook ? '📘' : isFair ? '🎪' : '🚀'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </span>
                        </button>
                      );
                    })}

                    {cell.items.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayModal({ dateStr: cell.dateStr, items: cell.items });
                        }}
                        style={{
                          border: 'none',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          borderRadius: 4,
                          padding: '2px 4px',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 3,
                        }}
                        title={`View all ${cell.items.length} events for ${cell.dateStr}`}
                      >
                        +{cell.items.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 2: MILESTONES & TIMELINE VIEW */}
        {viewMode === 'timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {timelineItems.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                <Clock size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No releases or campaigns in this date range</div>
                <p style={{ fontSize: 12.5, margin: '4px 0 0' }}>Adjust the month or clear your filters to view scheduled milestones.</p>
              </div>
            ) : (
              timelineItems.map((item, idx) => {
                const isBook = item.kind === 'book';
                const isFair = item.kind === 'fair';
                const accentColor = isBook ? '#2563eb' : isFair ? '#d97706' : '#7c3aed';
                const bgSoft = isBook ? '#eff6ff' : isFair ? '#fffbeb' : '#f5f3ff';

                return (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '16px 20px',
                      display: 'grid',
                      gridTemplateColumns: '140px minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: 20,
                      background: '#ffffff',
                      borderLeft: `5px solid ${accentColor}`,
                    }}
                  >
                    {/* Date Block */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Target Date
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                        {item.startDate}
                      </div>
                      {item.endDate && item.endDate !== item.startDate && (
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          to {item.endDate}
                        </div>
                      )}
                    </div>

                    {/* Milestone Details */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: bgSoft,
                            color: accentColor,
                            textTransform: 'uppercase',
                          }}
                        >
                          {isBook ? '📘 Book Release' : isFair ? '🎪 Book Fair Event' : '🚀 Marketing Campaign'}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                          {item.code}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: '#f1f5f9',
                            color: '#334155',
                          }}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>
                        {item.title}
                      </div>

                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {isBook && (
                          <>
                            <span>Format: <strong>{item.format || 'Paperback'}</strong></span>
                            {item.categoryName && <span>Genre: <strong>{item.categoryName}</strong></span>}
                          </>
                        )}
                        {!isBook && !isFair && (
                          <>
                            <span>Channel: <strong>{item.primaryChannel}</strong></span>
                            <span>Budget: <strong>৳{formatMoney(item.plannedBudget)}</strong></span>
                          </>
                        )}
                        {isFair && (
                          <>
                            <span>Venue: <strong>{item.venue}</strong></span>
                            {item.city && <span>City: <strong>{item.city}</strong></span>}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => exportIcs(item)}
                        title="Download .ics calendar file"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                      >
                        <Download size={13} />
                        <span>.ics</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => setSelectedItem(item)}
                        style={{ fontSize: 12 }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* VIEW 3: AGENDA VIEW */}
        {viewMode === 'agenda' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {timelineItems.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                <Clock size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No events scheduled</div>
              </div>
            ) : (
              timelineItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: item.kind === 'book' ? '#eff6ff' : item.kind === 'fair' ? '#fffbeb' : '#f5f3ff',
                        color: item.kind === 'book' ? '#2563eb' : item.kind === 'fair' ? '#d97706' : '#7c3aed',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 18,
                      }}
                    >
                      {item.kind === 'book' ? '📘' : item.kind === 'fair' ? '🎪' : '🚀'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                          {item.code}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                        Date: {item.startDate} {item.endDate && item.endDate !== item.startDate ? `to ${item.endDate}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => exportIcs(item)}
                      style={{ fontSize: 11.5 }}
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setSelectedItem(item)}
                      style={{ fontSize: 11.5 }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VIEW 4: TABULAR DATA VIEW */}
        {viewMode === 'table' && (
          <div className="table-wrap">
            <table className="data-table" style={{ width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Date</th>
                  <th style={{ width: 110 }}>Category</th>
                  <th>Title &amp; Code</th>
                  <th>Channel / Format</th>
                  <th>Details</th>
                  <th style={{ textAlign: 'center', width: 110 }}>Status</th>
                  <th style={{ textAlign: 'right', width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
                      No calendar records found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {item.startDate}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: item.kind === 'book' ? '#eff6ff' : item.kind === 'fair' ? '#fffbeb' : '#f5f3ff',
                            color: item.kind === 'book' ? '#1d4ed8' : item.kind === 'fair' ? '#b45309' : '#6d28d9',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.kind === 'book' ? '📘 Book Release' : item.kind === 'fair' ? '🎪 Fair Event' : '🚀 Campaign'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{item.code}</div>
                      </td>
                      <td>
                        {item.kind === 'book' ? (
                          <span>{item.format || 'Paperback'}</span>
                        ) : item.kind === 'campaign' ? (
                          <span style={{ textTransform: 'capitalize' }}>{item.primaryChannel}</span>
                        ) : (
                          <span>{item.eventType}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: '#475569' }}>
                        {item.kind === 'book' ? (
                          <span>{item.categoryName || 'General Publication'}</span>
                        ) : item.kind === 'campaign' ? (
                          <span>Budget: ৳{formatMoney(item.plannedBudget)}</span>
                        ) : (
                          <span>{item.venue}{item.city ? `, ${item.city}` : ''}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                            background: '#f1f5f9',
                            color: '#334155',
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => exportIcs(item)}
                            title="Download iCal (.ics)"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => setSelectedItem(item)}
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DAY EVENTS MODAL (triggered by clicking +N more or day cell) */}
      {selectedDayModal && (
        <div className="modal-backdrop" onClick={() => setSelectedDayModal(null)}>
          <div
            className="modal"
            style={{ width: 'min(680px, 96%)', padding: 24, borderRadius: 16 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarIcon size={14} /> Daily Schedule Overview
                </div>
                <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {new Date(selectedDayModal.dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setSelectedDayModal(null)}
                style={{ padding: '6px 8px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Event Count */}
            <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
              <strong>{selectedDayModal.items.length}</strong> events scheduled on this date:
            </div>

            {/* List of Events */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
              {selectedDayModal.items.map(item => {
                const isBook = item.kind === 'book';
                const isFair = item.kind === 'fair';
                const bg = isBook ? '#eff6ff' : isFair ? '#fffbeb' : '#f5f3ff';
                const color = isBook ? '#1d4ed8' : isFair ? '#b45309' : '#6d28d9';
                const border = isBook ? '#bfdbfe' : isFair ? '#fde68a' : '#ddd6fe';

                return (
                  <div
                    key={item.id}
                    style={{
                      border: `1px solid ${border}`,
                      borderRadius: 10,
                      background: bg,
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14 }}>{isBook ? '📘' : isFair ? '🎪' : '🚀'}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: color, textTransform: 'uppercase' }}>
                          {isBook ? 'Book Release' : isFair ? 'Book Fair' : 'Campaign'}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                          {item.code}
                        </span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: '#ffffff', color: '#334155' }}>
                          {item.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                        {isBook ? (
                          <span>Format: <strong>{item.format || 'Paperback'}</strong>{item.categoryName ? ` · ${item.categoryName}` : ''}</span>
                        ) : isFair ? (
                          <span>Venue: <strong>{item.venue}</strong>{item.city ? `, ${item.city}` : ''}</span>
                        ) : (
                          <span>Channel: <strong>{item.primaryChannel}</strong> · Budget: ৳{formatMoney(item.plannedBudget)}</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => exportIcs(item)}
                        title="Download .ics calendar file"
                        style={{ background: '#ffffff', fontSize: 11.5 }}
                      >
                        <Download size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setSelectedDayModal(null);
                          setSelectedItem(item);
                        }}
                        style={{ fontSize: 11.5 }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL / POPUP */}
      {selectedItem && (
        <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div
            className="modal"
            style={{ width: 'min(640px, 96%)', padding: 24, borderRadius: 16 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 12,
                    background: selectedItem.kind === 'book' ? '#eff6ff' : selectedItem.kind === 'fair' ? '#fffbeb' : '#f5f3ff',
                    color: selectedItem.kind === 'book' ? '#1d4ed8' : selectedItem.kind === 'fair' ? '#b45309' : '#6d28d9',
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedItem.kind === 'book' ? '📘 Commercial Book Launch' : selectedItem.kind === 'fair' ? '🎪 Book Fair Event' : '🚀 Marketing Campaign'}
                </span>
                <h3 style={{ margin: '8px 0 2px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {selectedItem.title}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                  Reference Code: {selectedItem.code}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setSelectedItem(null)}
                style={{ padding: '6px 8px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ display: 'grid', gap: 14, fontSize: 13, color: '#334155' }}>
              {/* Date Box */}
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Scheduled Window</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 2 }}>
                    {selectedItem.startDate} {selectedItem.endDate && selectedItem.endDate !== selectedItem.startDate ? `➔ ${selectedItem.endDate}` : ''}
                  </div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11.5, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8' }}>
                  Status: {selectedItem.status}
                </span>
              </div>

              {/* Specific details per type */}
              {selectedItem.kind === 'book' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="panel" style={{ padding: '10px 12px', background: '#ffffff', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Format / Binding</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedItem.format || 'Paperback'}</div>
                  </div>
                  <div className="panel" style={{ padding: '10px 12px', background: '#ffffff', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Category / Genre</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedItem.categoryName || 'General Publication'}</div>
                  </div>
                  <div className="panel" style={{ padding: '10px 12px', background: '#ffffff', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Target Audience</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedItem.targetAudience || 'General Readers'}</div>
                  </div>
                  <div className="panel" style={{ padding: '10px 12px', background: '#ffffff', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Language</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedItem.language?.toUpperCase() || 'BN'}</div>
                  </div>
                </div>
              )}

              {selectedItem.kind === 'campaign' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="panel" style={{ padding: '10px 12px', background: '#ffffff', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Primary Channel</div>
                      <div style={{ fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>{selectedItem.primaryChannel}</div>
                    </div>
                    <div className="panel" style={{ padding: '10px 12px', background: '#ffffff', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Planned Budget</div>
                      <div style={{ fontWeight: 700, color: '#059669', marginTop: 2 }}>৳ {formatMoney(selectedItem.plannedBudget)}</div>
                    </div>
                  </div>
                  {selectedItem.objective && (
                    <div className="panel" style={{ padding: '10px 12px', background: '#ffffff', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Campaign Objective</div>
                      <div style={{ marginTop: 2, fontSize: 12.5 }}>{selectedItem.objective}</div>
                    </div>
                  )}
                </div>
              )}

              {selectedItem.kind === 'fair' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="panel" style={{ padding: '10px 12px', background: '#ffffff', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Venue &amp; Location</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedItem.venue}{selectedItem.city ? `, ${selectedItem.city}` : ''}</div>
                  </div>
                  <div className="panel" style={{ padding: '10px 12px', background: '#ffffff', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Sales Target</div>
                    <div style={{ fontWeight: 700, color: '#059669', marginTop: 2 }}>৳ {formatMoney(selectedItem.salesTarget)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn"
                onClick={() => exportIcs(selectedItem)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <Download size={14} />
                <span>Download .ics file</span>
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                {selectedItem.kind === 'campaign' && (
                  <Link
                    className="btn btn-primary"
                    href={`/marketing-promotions/create-campaign?campaign=${selectedItem.id}`}
                    style={{ fontSize: 12 }}
                  >
                    Open Campaign Plan
                  </Link>
                )}
                {selectedItem.kind === 'fair' && (
                  <Link
                    className="btn btn-primary"
                    href={`/book-fair-events/fair-setup-and-booth?event=${selectedItem.id}`}
                    style={{ fontSize: 12 }}
                  >
                    Open Fair Booths
                  </Link>
                )}
                {selectedItem.kind === 'book' && (
                  <Link
                    className="btn btn-primary"
                    href={`/publishing-catalog/book-master?book=${selectedItem.id}`}
                    style={{ fontSize: 12 }}
                  >
                    Open in Catalog
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
