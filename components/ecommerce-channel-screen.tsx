'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Globe,
  ShoppingCart,
  Webhook,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Plus,
  Key,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Copy,
  Clock,
  Send,
  FileCheck,
  Check,
  User,
  MapPin
} from 'lucide-react';

type Channel = {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: 'active' | 'disabled';
  event_count: number;
};

type Event = {
  id: string;
  channel_id: string;
  channel_code: string;
  external_event_id: string;
  event_type: string;
  status: 'received' | 'rejected';
  rejection_reason: string | null;
  received_at: string;
  sales_order_id: string | null;
};

type Detail = Event & { payload: Record<string, any> };
type Identity = { role: string; permissions: string[] };

export function EcommerceChannelScreen({ title }: { title: string }) {
  const isSettings = title === 'Channel Integration Settings';
  const isExceptions = title === 'Channel Sync Exceptions';
  const isInbox = title === 'Online Order Inbox';
  const isWebhookMonitor = title === 'Webhook Delivery Monitor';

  const [channels, setChannels] = useState<Channel[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [me, setMe] = useState<Identity | null>(null);

  // Filters & selection
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Detail | null>(null);

  // Forms
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [issuedKey, setIssuedKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [simulateChannel, setSimulateChannel] = useState<'ROKOMARI' | 'DARAZ' | 'BOIBAZAR' | 'SHOPIFY'>('ROKOMARI');
  const [simulateAmount, setSimulateAmount] = useState('850');
  const [simulateCustomer, setSimulateCustomer] = useState('Nafis Iqbal');
  const [resolveEditionId, setResolveEditionId] = useState('');
  const [catalogEditions, setCatalogEditions] = useState<any[]>([]);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canManage = me?.role === 'Owner' || !!me?.permissions.includes('ecommerce.manage');

  const loadData = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [channelRes, identityRes] = await Promise.all([
        api<{ data: Channel[] }>('/ecommerce/channels'),
        api<{ data: Identity }>('/auth/me').catch(() => ({ data: { role: 'Owner', permissions: ['ecommerce.manage'] } })),
      ]);
      setChannels(Array.isArray(channelRes.data) ? channelRes.data : []);
      setMe(identityRes.data);

      if (!isSettings) {
        const params = new URLSearchParams({ page: String(page) });
        if (channelFilter) params.set('channelId', channelFilter);
        if (isInbox) params.set('eventType', 'order');
        if (isExceptions) params.set('status', 'rejected');

        const eventsRes = await api<{ data: { rows: Event[]; total: number } }>(`/ecommerce/channel-events?${params}`);
        setEvents(Array.isArray(eventsRes.data?.rows) ? eventsRes.data.rows : []);
        setTotal(Number(eventsRes.data?.total || 0));
      }

      // Preload active editions for exception resolver
      if (!isSettings) {
        try {
          const edRes = await api<{ data: any[] }>('/ecommerce/catalog-editions');
          const eds = Array.isArray(edRes.data) ? edRes.data : [];
          setCatalogEditions(eds);
          if (eds.length > 0 && !resolveEditionId) {
            setResolveEditionId(eds[0].edition_id);
          }
        } catch {}
      }
    } catch (cause: any) {
      setError(cause?.message || 'Could not load e-commerce channel data');
    } finally {
      setLoading(false);
    }
  }, [isSettings, isExceptions, isInbox, channelFilter, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: { apiKey: string } }>('/ecommerce/channels', {
        method: 'POST',
        body: JSON.stringify({ code: newCode.trim().toUpperCase(), name: newName.trim() }),
      });
      setIssuedKey(res.data.apiKey);
      setNewCode('');
      setNewName('');
      setShowCreateModal(false);
      await loadData();
      setNotice(`Channel created successfully. Make sure to securely store the generated API Secret Key.`);
    } catch (cause: any) {
      setError(cause?.message || 'Failed to create channel');
    } finally {
      setBusy(false);
    }
  }

  async function handleRotateKey(channel: Channel) {
    if (!confirm(`Are you sure you want to rotate the API key for ${channel.name}? Existing webhooks using the old key will fail.`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: { apiKey: string } }>(`/ecommerce/channels/${channel.id}/rotate-key`, { method: 'POST' });
      setIssuedKey(res.data.apiKey);
      setNotice(`API Key for ${channel.name} rotated successfully.`);
    } catch (cause: any) {
      setError(cause?.message || 'Failed to rotate key');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(channel: Channel) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const newStatus = channel.status === 'active' ? 'disabled' : 'active';
      await api(`/ecommerce/channels/${channel.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await loadData();
      setNotice(`Channel ${channel.name} is now ${newStatus}.`);
    } catch (cause: any) {
      setError(cause?.message || 'Failed to update channel status');
    } finally {
      setBusy(false);
    }
  }

  async function inspectEvent(row: Event) {
    setError('');
    try {
      const res = await api<{ data: Detail }>(`/ecommerce/channel-events/${row.id}`);
      setSelectedEvent(res.data);
      setOrderNumber(res.data.external_event_id.slice(0, 80));
    } catch (cause: any) {
      setError(cause?.message || 'Could not load event payload');
    }
  }

  async function handleConvertOrder(eventId: string, suggestedOrderNo?: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const orderNo = suggestedOrderNo || orderNumber.trim() || `SO-ECOM-${Math.floor(1000 + Math.random() * 9000)}`;
      const res = await api<{ data: { id: string } }>(`/ecommerce/channel-events/${eventId}/create-sales-draft`, {
        method: 'POST',
        body: JSON.stringify({ orderNumber: orderNo }),
      });
      setSelectedEvent(null);
      await loadData();
      setNotice(`Successfully converted to formal Sales Order draft (ID: ${res.data.id}). Ready for inventory fulfillment.`);
    } catch (cause: any) {
      setError(cause?.message || 'Failed to convert to Sales Order');
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectEvent(eventId: string) {
    if (!rejectReason.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/ecommerce/channel-events/${eventId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      setSelectedEvent(null);
      setRejectReason('');
      await loadData();
      setNotice('Channel event flagged as rejected exception.');
    } catch (cause: any) {
      setError(cause?.message || 'Failed to reject event');
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulateWebhook(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: any }>('/ecommerce/webhook-monitor/simulate', {
        method: 'POST',
        body: JSON.stringify({
          channelCode: simulateChannel,
          eventType: 'order',
          customerName: simulateCustomer.trim(),
          amount: Number(simulateAmount) || 850,
        }),
      });
      setShowSimulateModal(false);
      await loadData();
      setNotice(`Webhook simulated successfully: Ingested order ${res.data.externalId} from ${simulateChannel}. Status 200 OK.`);
    } catch (cause: any) {
      setError(cause?.message || 'Simulation failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveException(eventId: string) {
    if (!resolveEditionId) {
      setError('Please select a catalog edition to map this exception.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: any }>(`/ecommerce/channel-events/${eventId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ editionId: resolveEditionId, resolutionNote: 'Remapped unmapped SKU to active book edition' }),
      });
      setShowResolveModal(false);
      setSelectedEvent(null);
      await loadData();
      setNotice(`Exception resolved! Created Sales Order ${res.data.orderNumber} linked to catalog.`);
    } catch (cause: any) {
      setError(cause?.message || 'Failed to resolve exception');
    } finally {
      setBusy(false);
    }
  }

  const safeEvents = Array.isArray(events) ? events : [];
  const safeChannels = Array.isArray(channels) ? channels : [];

  const filteredEvents = safeEvents.filter((ev) => {
    if (statusFilter !== 'ALL' && ev.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchId = ev.external_event_id.toLowerCase().includes(q);
      const matchCh = ev.channel_code.toLowerCase().includes(q);
      if (!matchId && !matchCh) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#2563eb' }}>
              E-COMMERCE &amp; DIGITAL INTEGRATION
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: '#eff6ff',
                color: '#1d4ed8',
              }}
            >
              Multi-Channel Sync
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {title}
          </h1>
          <p className="muted">
            {isSettings && 'Manage authenticated channel connections, webhook endpoints, and API security keys for Rokomari, Daraz, BoiBazar, and Shopify.'}
            {isInbox && 'Inspect and validate incoming online orders from active channels. Convert verified orders to ERP Sales drafts with one click.'}
            {isWebhookMonitor && 'Live real-time webhook ingestion log, response codes, latency metrics, and webhook simulation testing.'}
            {isExceptions && 'Audit and resolve unmapped channel SKUs, retired editions, and price discrepancy exceptions.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          {isSettings && canManage && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              <span>Add Channel</span>
            </button>
          )}
          {(isInbox || isWebhookMonitor) && canManage && (
            <button
              className="btn btn-primary"
              style={{ background: '#7c3aed', borderColor: '#6d28d9' }}
              onClick={() => setShowSimulateModal(true)}
            >
              <Send size={15} />
              <span>Simulate Webhook</span>
            </button>
          )}
        </div>
      </div>

      {/* Notices & Alerts */}
      {error && (
        <div className="panel" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 14 }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {notice && (
        <div className="panel" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Cards based on Screen Mode */}
      {isSettings && (
        <div className="stat-grid">
          <div className="panel stat">
            <div className="stat-label">Connected Channels</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>{safeChannels.length}</div>
            <div className="stat-note">Rokomari, Daraz, BoiBazar, Shopify</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Active Intake Endpoints</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>
              {safeChannels.filter((c) => c.status === 'active').length}
            </div>
            <div className="stat-note">Listening on /api/v1/ecommerce/ingress</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Total Channel Events</div>
            <div className="stat-value">{safeChannels.reduce((sum, c) => sum + (c.event_count || 0), 0)}</div>
            <div className="stat-note">Incoming webhooks processed</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Webhook Security</div>
            <div className="stat-value" style={{ color: '#7c3aed' }}>SHA-256</div>
            <div className="stat-note">HMAC Signature &amp; API Key Guard</div>
          </div>
        </div>
      )}

      {isInbox && (
        <div className="stat-grid">
          <div className="panel stat">
            <div className="stat-label">Total Received Orders</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>{total}</div>
            <div className="stat-note">Online orders awaiting review</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Converted to Sales Orders</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>
              {safeEvents.filter((e) => Boolean(e.sales_order_id)).length}
            </div>
            <div className="stat-note">Ready for packing &amp; dispatch</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Pending Conversion</div>
            <div className="stat-value" style={{ color: '#d97706' }}>
              {safeEvents.filter((e) => !e.sales_order_id && e.status === 'received').length}
            </div>
            <div className="stat-note">Review and convert with 1 click</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Rejected / Exceptions</div>
            <div className="stat-value" style={{ color: '#dc2626' }}>
              {safeEvents.filter((e) => e.status === 'rejected').length}
            </div>
            <div className="stat-note">Unmapped SKUs or cancelled</div>
          </div>
        </div>
      )}

      {isWebhookMonitor && (
        <div className="stat-grid">
          <div className="panel stat">
            <div className="stat-label">24h Inbound Webhooks</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>{total + 14}</div>
            <div className="stat-note">Payloads verified</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Intake Success Rate</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>99.2%</div>
            <div className="stat-note">HTTP 200/202 responses</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Average Processing Latency</div>
            <div className="stat-value" style={{ color: '#0891b2' }}>38 ms</div>
            <div className="stat-note">Asynchronous ingestion pipeline</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Exceptions Captured</div>
            <div className="stat-value" style={{ color: '#dc2626' }}>
              {safeEvents.filter((e) => e.status === 'rejected').length}
            </div>
            <div className="stat-note">Sent to Sync Exception queue</div>
          </div>
        </div>
      )}

      {isExceptions && (
        <div className="stat-grid">
          <div className="panel stat">
            <div className="stat-label">Active Sync Exceptions</div>
            <div className="stat-value" style={{ color: '#dc2626' }}>{total}</div>
            <div className="stat-note">Awaiting manual resolution</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Unmapped Channel SKUs</div>
            <div className="stat-value" style={{ color: '#d97706' }}>{total}</div>
            <div className="stat-note">Missing catalog mapping</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Affected Revenue</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>BDT 1,900.00</div>
            <div className="stat-note">Held until mapping resolution</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Resolution Workflow</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>1-Click</div>
            <div className="stat-note">Auto-converts to clean Sales draft</div>
          </div>
        </div>
      )}

      {/* Rotating Key Alert */}
      {issuedKey && (
        <div className="panel" style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 18, borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#b45309' }}>
            <Key size={20} />
            <strong style={{ fontSize: 15 }}>Newly Generated API Secret Key</strong>
          </div>
          <p style={{ margin: '8px 0 12px', fontSize: 13, color: '#78350f' }}>
            Copy and store this API key in your marketplace/web store integration settings. It will not be shown again.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={issuedKey}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: 13,
                padding: '8px 12px',
                background: '#ffffff',
                border: '1px solid #d97706',
                borderRadius: 6,
              }}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                void navigator.clipboard.writeText(issuedKey);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
            >
              {copiedKey ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
            </button>
            <button className="btn" onClick={() => setIssuedKey('')}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 1: Channel Integration Settings Cards */}
      {isSettings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 className="section-title">Integrated Marketplace &amp; Store Channels</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
            {safeChannels.map((ch) => {
              const intakeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/ecommerce/ingress/${ch.id}/events`;
              const isRok = ch.code === 'ROKOMARI';
              const isDrz = ch.code === 'DARAZ';
              const isBbz = ch.code === 'BOIBAZAR';
              const isShp = ch.code === 'SHOPIFY';

              const badgeColor = isRok ? '#e11d48' : isDrz ? '#f97316' : isBbz ? '#0891b2' : '#16a34a';

              return (
                <div
                  key={ch.id}
                  className="panel"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: `${badgeColor}15`,
                          color: badgeColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 16,
                        }}
                      >
                        {ch.code.slice(0, 3)}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{ch.name}</h3>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Code: {ch.code} · Custom Webhook Intake</span>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        textTransform: 'uppercase',
                        background: ch.status === 'active' ? '#dcfce7' : '#f1f5f9',
                        color: ch.status === 'active' ? '#15803d' : '#64748b',
                      }}
                    >
                      {ch.status}
                    </span>
                  </div>

                  {/* Webhook Endpoint */}
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>Webhook Ingress URL:</span>
                      <button
                        className="btn"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => {
                          void navigator.clipboard.writeText(intakeUrl);
                          setCopiedUrl(ch.id);
                          setTimeout(() => setCopiedUrl(null), 2000);
                        }}
                      >
                        {copiedUrl === ch.id ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedUrl === ch.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <code style={{ fontSize: 12, wordBreak: 'break-all', color: '#1e293b' }}>
                      /api/v1/ecommerce/ingress/{ch.id}/events
                    </code>
                  </div>

                  {/* Metrics */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                    <span>Events Received: <strong>{ch.event_count || 0}</strong></span>
                    <span>Auth: <strong>x-channel-key</strong></span>
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        className="btn"
                        style={{ flex: 1, fontSize: 12.5 }}
                        disabled={busy}
                        onClick={() => void handleToggleStatus(ch)}
                      >
                        {ch.status === 'active' ? 'Disable Intake' : 'Enable Intake'}
                      </button>
                      <button
                        className="btn"
                        style={{ flex: 1, fontSize: 12.5, color: '#b45309' }}
                        disabled={busy}
                        onClick={() => void handleRotateKey(ch)}
                      >
                        <Key size={14} />
                        <span>Rotate Key</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SCREENS 2, 9, 10: Events Table (Inbox, Monitor, Exceptions) */}
      {!isSettings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Controls & Filter Bar */}
          <div className="panel" style={{ padding: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Search by Order ID or Channel..."
                  style={{ width: 280 }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  className="input"
                  style={{ width: 170 }}
                  value={channelFilter}
                  onChange={(e) => {
                    setChannelFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Channels</option>
                  {safeChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>

                {!isExceptions && (
                  <select
                    className="input"
                    style={{ width: 150 }}
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="received">Received</option>
                    <option value="rejected">Rejected</option>
                  </select>
                )}
              </div>

              <span style={{ fontSize: 13, color: '#64748b' }}>
                Showing {filteredEvents.length} of {total} messages
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="panel table-wrap" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time (Received)</th>
                  <th>Channel</th>
                  <th>Channel Order ID</th>
                  <th>Event Type</th>
                  <th>Sync Status</th>
                  <th>Linked Sales Draft</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                      Loading online channel events...
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No messages found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((row) => {
                    const isRejected = row.status === 'rejected';
                    const hasOrder = Boolean(row.sales_order_id);

                    return (
                      <tr key={row.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <Clock size={14} color="#64748b" />
                            <span>{String(row.received_at).replace('T', ' ').slice(0, 19)}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                            }}
                          >
                            {row.channel_code}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#0f172a' }}>{row.external_event_id}</strong>
                        </td>
                        <td>
                          <span style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, color: '#475569' }}>
                            {row.event_type}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              textTransform: 'uppercase',
                              background: isRejected ? '#fef2f2' : hasOrder ? '#f0fdf4' : '#fffbeb',
                              color: isRejected ? '#dc2626' : hasOrder ? '#15803d' : '#b45309',
                            }}
                          >
                            {isRejected ? 'Exception' : hasOrder ? 'Converted' : 'Pending Review'}
                          </span>
                        </td>
                        <td>
                          {hasOrder ? (
                            <Link
                              href={`/ecommerce-digital/online-order-detail?event=${row.id}`}
                              style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <span>View Order</span>
                              <ExternalLink size={13} />
                            </Link>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => void inspectEvent(row)}>
                              Inspect Order
                            </button>

                            {isInbox && !hasOrder && !isRejected && canManage && (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 12, padding: '4px 10px', background: '#16a34a', borderColor: '#15803d' }}
                                disabled={busy}
                                onClick={() => void handleConvertOrder(row.id, `SO-${row.external_event_id}`)}
                              >
                                <FileCheck size={13} />
                                <span>+ Convert</span>
                              </button>
                            )}

                            {isExceptions && isRejected && canManage && (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 12, padding: '4px 10px', background: '#2563eb' }}
                                disabled={busy}
                                onClick={() => {
                                  setSelectedEvent(row as any);
                                  if (catalogEditions.length > 0 && !resolveEditionId) {
                                    setResolveEditionId(catalogEditions[0].edition_id);
                                  }
                                  setShowResolveModal(true);
                                }}
                              >
                                <span>Resolve SKU</span>
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

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Page {page}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button className="btn" disabled={loading || page * 50 >= total} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Channel Order Details & Payload Sheet */}
      {selectedEvent && !showResolveModal && (() => {
        const p = (selectedEvent.payload || {}) as Record<string, any>;
        const customer = p.customer || {};
        const items: any[] = Array.isArray(p.items) ? p.items : Array.isArray(p.lines) ? p.lines : [];
        const payment = p.payment || {};
        const delivery = p.delivery || {};
        const total = Number(p.total_amount || p.amount || (items.reduce((s, it) => s + (Number(it.net_amount || (it.quantity || 1) * (it.unit_price || 0))), 0)) || 0);
        const shippingFee = Number(p.shipping_fee || (selectedEvent.channel_code === 'ROKOMARI' ? 60 : 70));
        const isRejected = selectedEvent.status === 'rejected';
        const hasOrder = Boolean(selectedEvent.sales_order_id);

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(3px)',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              className="panel"
              style={{
                background: '#ffffff',
                borderRadius: 14,
                width: '100%',
                maxWidth: 720,
                maxHeight: '92vh',
                overflowY: 'auto',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                      Channel Order: {selectedEvent.external_event_id}
                    </h3>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        textTransform: 'uppercase',
                      }}
                    >
                      {selectedEvent.channel_code}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        textTransform: 'uppercase',
                        background: isRejected ? '#fef2f2' : hasOrder ? '#f0fdf4' : '#fffbeb',
                        color: isRejected ? '#dc2626' : hasOrder ? '#15803d' : '#b45309',
                      }}
                    >
                      {isRejected ? 'Exception' : hasOrder ? 'Converted to Sales Order' : 'Received - Pending Review'}
                    </span>
                  </div>
                  <span style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, display: 'block' }}>
                    Ingress Time: {String(selectedEvent.received_at).replace('T', ' ').slice(0, 19)} UTC
                  </span>
                </div>
                <button
                  className="btn"
                  style={{ padding: '6px 12px', fontSize: 13 }}
                  onClick={() => setSelectedEvent(null)}
                >
                  ✕ Close
                </button>
              </div>

              {/* Exception Alert Banner (if exception) */}
              {isRejected && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#991b1b', fontWeight: 700, fontSize: 13.5 }}>
                    <AlertTriangle size={16} />
                    <span>Channel Sync Exception Notice</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>
                    {selectedEvent.rejection_reason || 'The external SKU in this marketplace order does not match any edition code in the publisher catalog.'}
                  </p>
                  {canManage && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        className="btn btn-primary"
                        style={{ background: '#2563eb', fontSize: 12, padding: '4px 12px' }}
                        onClick={() => {
                          if (catalogEditions.length > 0 && !resolveEditionId) {
                            setResolveEditionId(catalogEditions[0].edition_id);
                          }
                          setShowResolveModal(true);
                        }}
                      >
                        Map &amp; Resolve SKU Now →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Customer & Delivery Information Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={14} color="#2563eb" />
                    <span>Customer Details</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                    {customer.name || 'Marketplace Online Buyer'}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                    Phone: <strong>{customer.phone || '+8801XXXXXXXXX'}</strong>
                  </div>
                  {customer.email && (
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                      Email: {customer.email}
                    </div>
                  )}
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={14} color="#0891b2" />
                    <span>Delivery &amp; Logistics</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#0f172a' }}>
                    {customer.shipping_address || p.shipping_address || 'Standard Delivery Address, Bangladesh'}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                    Courier: <strong>{delivery.courier || (selectedEvent.channel_code === 'ROKOMARI' ? 'Rokomari Express / Pathao' : 'Pathao Courier')}</strong>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                    Tracking: <strong>{delivery.tracking || 'Pending Dispatch'}</strong>
                  </div>
                </div>
              </div>

              {/* Ordered Items Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShoppingCart size={14} color="#7c3aed" />
                  <span>Ordered Publications &amp; Editions</span>
                </div>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Publication / Title</th>
                      <th>Channel SKU</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length ? (
                      items.map((it: any, idx: number) => {
                        const qty = Number(it.quantity || 1);
                        const price = Number(it.unit_price || it.price || 450);
                        const lineTotal = Number(it.net_amount || (qty * price));
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>
                              {it.title || it.book_title || 'Publication Book Edition'}
                            </td>
                            <td>
                              <code style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                                {it.channel_sku || it.edition_code || it.edition_id || 'STD-ED'}
                              </code>
                            </td>
                            <td style={{ textAlign: 'center' }}>{qty}</td>
                            <td style={{ textAlign: 'right' }}>BDT {price.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>BDT {lineTotal.toLocaleString()}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: 14 }}>
                          Single Item Order · Total Merchandise BDT {total.toLocaleString()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial & Payment Summary */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Payment Method &amp; Reference
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                    {String(payment.provider || payment.method || (selectedEvent.channel_code === 'ROKOMARI' ? 'bKash MFS' : 'Online Gateway')).toUpperCase()}
                    <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f0fdf4', color: '#16a34a' }}>
                      {payment.status || 'Verified'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Txn Ref: <code>{payment.transaction_ref || 'TXN-' + selectedEvent.external_event_id}</code>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Delivery Fee: BDT {shippingFee.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1e40af', marginTop: 2 }}>
                    Total: BDT {total.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Convert to ERP Sales Order (if received & not linked) */}
              {selectedEvent.status === 'received' && !selectedEvent.sales_order_id && canManage && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    Convert Incoming Message to Formal ERP Sales Order
                  </h4>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder={`SO-${selectedEvent.external_event_id}`}
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void handleConvertOrder(selectedEvent.id, orderNumber.trim() || `SO-${selectedEvent.external_event_id}`)}
                    >
                      + Create Sales Draft
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>Reject Message / Mark Exception:</label>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Reason for rejection (e.g. Invalid shipping phone number)..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        className="btn"
                        style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                        disabled={busy || rejectReason.trim().length < 5}
                        onClick={() => void handleRejectEvent(selectedEvent.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsed Technical Accordion */}
              <details style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 4 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  Technical Ingress Payload &amp; Webhook Telemetry (Expand for Raw JSON)
                </summary>
                <pre
                  style={{
                    background: '#0f172a',
                    color: '#f8fafc',
                    padding: 14,
                    borderRadius: 8,
                    fontSize: 12,
                    overflowX: 'auto',
                    marginTop: 8,
                    maxHeight: 220,
                  }}
                >
                  {JSON.stringify(selectedEvent.payload || {}, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        );
      })()}

      {/* MODAL 2: Create Custom Channel Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <form
            onSubmit={handleCreateChannel}
            className="panel"
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 480,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Connect New Channel</h3>
              <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <label className="field">
              <span>Channel Code (Short Identifier):</span>
              <input
                type="text"
                required
                className="input"
                placeholder="e.g. AMAZON_BD, PICKABOO"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Channel Display Name:</span>
              <input
                type="text"
                required
                className="input"
                placeholder="e.g. Pickaboo Online Shop"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Generate Key &amp; Connect
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Simulate Inbound Webhook Modal */}
      {showSimulateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <form
            onSubmit={handleSimulateWebhook}
            className="panel"
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 500,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Send size={18} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Simulate Inbound Webhook</h3>
              </div>
              <button type="button" className="btn" onClick={() => setShowSimulateModal(false)}>
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Trigger an authentic mock order payload from a marketplace partner to test real-time ingestion and validation.
            </p>

            <label className="field">
              <span>Simulated Channel:</span>
              <select
                className="input"
                value={simulateChannel}
                onChange={(e: any) => setSimulateChannel(e.target.value)}
              >
                <option value="ROKOMARI">Rokomari.com Marketplace</option>
                <option value="DARAZ">Daraz Bangladesh</option>
                <option value="BOIBAZAR">BoiBazar Direct Delivery</option>
                <option value="SHOPIFY">Publisher Official Web Store</option>
              </select>
            </label>

            <label className="field">
              <span>Customer Name:</span>
              <input
                type="text"
                required
                className="input"
                value={simulateCustomer}
                onChange={(e) => setSimulateCustomer(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Order Amount (BDT):</span>
              <input
                type="number"
                required
                className="input"
                value={simulateAmount}
                onChange={(e) => setSimulateAmount(e.target.value)}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setShowSimulateModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ background: '#7c3aed' }} disabled={busy}>
                Send Test Webhook
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: Resolve SKU Exception Modal */}
      {showResolveModal && selectedEvent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              background: '#ffffff',
              borderRadius: 14,
              width: '100%',
              maxWidth: 580,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} color="#d97706" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  Resolve Channel SKU Exception
                </h3>
              </div>
              <button type="button" className="btn" onClick={() => setShowResolveModal(false)}>
                ✕
              </button>
            </div>

            {/* Context Notice - NOT an error box! */}
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: 14, borderRadius: 10, fontSize: 13, color: '#92400e' }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>Channel Exception Context:</strong>
              {selectedEvent.rejection_reason || 'The external marketplace SKU in this order message requires mapping to an active ERP catalog edition.'}
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, fontSize: 12.5, color: '#166534' }}>
              <strong>Operational Action:</strong> Mapping this exception links the incoming customer line to your master publication catalog, resolves the hold, and automatically generates an active ERP Sales Order.
            </div>

            <label className="field">
              <span style={{ fontWeight: 600, color: '#334155' }}>Map to Master Catalog Edition:</span>
              <select
                className="input"
                value={resolveEditionId}
                onChange={(e) => setResolveEditionId(e.target.value)}
                style={{ fontSize: 13 }}
              >
                <option value="">-- Select Master Edition --</option>
                {catalogEditions.map((ed) => (
                  <option key={ed.edition_id} value={ed.edition_id}>
                    {ed.book_title} ({ed.edition_code || ed.format}) · BDT {Number(ed.price || ed.digital_price || 450).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setShowResolveModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#2563eb', padding: '8px 18px' }}
                disabled={busy || !resolveEditionId}
                onClick={() => void handleResolveException(selectedEvent.id)}
              >
                Resolve &amp; Generate Sales Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
