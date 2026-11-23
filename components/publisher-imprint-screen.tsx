"use client";

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Publisher = {
  id: string;
  code: string | null;
  name: string;
  legal_name: string | null;
  contact_email: string | null;
  website: string | null;
  status: string;
  version_no: number;
  book_count: number;
};

type Imprint = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  status: string;
  version_no: number;
};

export function PublisherImprintScreen({ screen }: { screen: Screen }) {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [selectedPublisherId, setSelectedPublisherId] = useState<string>('');
  const [imprints, setImprints] = useState<Imprint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Permissions & User state
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [imprintsLoading, setImprintsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Modals state
  const [showPublisherModal, setShowPublisherModal] = useState(false);
  const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);
  const [publisherForm, setPublisherForm] = useState({
    code: '',
    name: '',
    legalName: '',
    email: '',
    website: '',
    status: 'active' as 'active' | 'inactive',
  });

  const [showImprintModal, setShowImprintModal] = useState(false);
  const [editingImprint, setEditingImprint] = useState<Imprint | null>(null);
  const [imprintForm, setImprintForm] = useState({
    code: '',
    name: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });

  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');

  // Load initial data
  async function loadPublishers() {
    setError('');
    try {
      const res = await api<{ data: Publisher[] }>('/publishers');
      setPublishers(res.data);
      if (!selectedPublisherId && res.data.length > 0) {
        setSelectedPublisherId(res.data[0].id);
      } else if (selectedPublisherId && !res.data.some(p => p.id === selectedPublisherId)) {
        setSelectedPublisherId(res.data[0]?.id || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load publishers');
    }
  }

  async function loadImprints(pubId: string) {
    if (!pubId) {
      setImprints([]);
      return;
    }
    setImprintsLoading(true);
    try {
      const res = await api<{ data: Imprint[] }>(`/publishers/${pubId}/imprints`);
      setImprints(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load imprints');
    } finally {
      setImprintsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      api<{ data: Publisher[] }>('/publishers'),
    ])
      .then(([meRes, pubRes]) => {
        setRole(meRes.data.role);
        setPermissions(meRes.data.permissions);
        setPublishers(pubRes.data);
        if (pubRes.data.length > 0) {
          setSelectedPublisherId(pubRes.data[0].id);
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Initialization error'))
      .finally(() => setLoading(false));
  }, [screen.id]);

  useEffect(() => {
    if (selectedPublisherId) {
      void loadImprints(selectedPublisherId);
    } else {
      setImprints([]);
    }
  }, [selectedPublisherId]);

  const selectedPublisher = useMemo(
    () => publishers.find(p => p.id === selectedPublisherId),
    [publishers, selectedPublisherId]
  );

  // Filtered publishers
  const filteredPublishers = useMemo(() => {
    return publishers.filter(p => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.legal_name && p.legal_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        statusFilter === 'all' || p.status.toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [publishers, searchQuery, statusFilter]);

  // Aggregate stats
  const totalPublishers = publishers.length;
  const activePublishers = publishers.filter(p => p.status === 'active').length;
  const totalBooks = publishers.reduce((acc, p) => acc + (Number(p.book_count) || 0), 0);

  // Handlers for Publisher Modal
  function openNewPublisherModal() {
    setEditingPublisher(null);
    setPublisherForm({
      code: '',
      name: '',
      legalName: '',
      email: '',
      website: '',
      status: 'active',
    });
    setShowPublisherModal(true);
    setError('');
  }

  function openEditPublisherModal(pub: Publisher) {
    setEditingPublisher(pub);
    setPublisherForm({
      code: pub.code || '',
      name: pub.name,
      legalName: pub.legal_name || '',
      email: pub.contact_email || '',
      website: pub.website || '',
      status: (pub.status as 'active' | 'inactive') || 'active',
    });
    setShowPublisherModal(true);
    setError('');
  }

  async function handleSavePublisher(e: React.FormEvent) {
    e.preventDefault();
    if (!publisherForm.name.trim()) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        name: publisherForm.name.trim(),
        code: publisherForm.code.trim() || (editingPublisher ? null : undefined),
        legalName: publisherForm.legalName.trim() || (editingPublisher ? null : undefined),
        email: publisherForm.email.trim() || (editingPublisher ? null : undefined),
        website: publisherForm.website.trim() || (editingPublisher ? null : undefined),
        status: publisherForm.status,
      };

      if (editingPublisher) {
        await api(`/publishers/${editingPublisher.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...payload, version: editingPublisher.version_no }),
        });
        setNotice(`Publisher "${payload.name}" updated successfully.`);
      } else {
        const res = await api<{ data: { id: string } }>('/publishers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSelectedPublisherId(res.data.id);
        setNotice(`Publisher "${payload.name}" created successfully.`);
      }

      setShowPublisherModal(false);
      await loadPublishers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save publisher');
    } finally {
      setBusy(false);
    }
  }

  // Handlers for Imprint Modal
  function openNewImprintModal() {
    if (!selectedPublisherId) return;
    setEditingImprint(null);
    setImprintForm({
      code: '',
      name: '',
      description: '',
      status: 'active',
    });
    setShowImprintModal(true);
    setError('');
  }

  function openEditImprintModal(imp: Imprint) {
    setEditingImprint(imp);
    setImprintForm({
      code: imp.code || '',
      name: imp.name,
      description: imp.description || '',
      status: (imp.status as 'active' | 'inactive') || 'active',
    });
    setShowImprintModal(true);
    setError('');
  }

  async function handleSaveImprint(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPublisherId || !imprintForm.name.trim()) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        name: imprintForm.name.trim(),
        code: imprintForm.code.trim() || (editingImprint ? null : undefined),
        description: imprintForm.description.trim() || (editingImprint ? null : undefined),
        status: imprintForm.status,
      };

      if (editingImprint) {
        await api(`/publishers/${selectedPublisherId}/imprints/${editingImprint.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...payload, version: editingImprint.version_no }),
        });
        setNotice(`Imprint "${payload.name}" updated successfully.`);
      } else {
        await api(`/publishers/${selectedPublisherId}/imprints`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setNotice(`Imprint "${payload.name}" added to ${selectedPublisher?.name}.`);
      }

      setShowImprintModal(false);
      await loadImprints(selectedPublisherId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save imprint');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Configure enterprise publishers, imprint subdivisions, and organizational catalog branding.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canCreate && (
            <button
              className="btn btn-primary"
              onClick={openNewPublisherModal}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>➕</span>
              <span>New Publisher</span>
            </button>
          )}
          <button className="btn" onClick={() => void loadPublishers()}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '16px' }}>
          {notice}
        </div>
      )}

      {/* KPI Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div
          className="panel"
          onClick={() => setStatusFilter('all')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: statusFilter === 'all' ? '4px solid #4f46e5' : '4px solid transparent',
            background: statusFilter === 'all' ? 'var(--panel-active-bg, #f5f3ff)' : undefined,
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            🏢 Total Publishers
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalPublishers}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Click to view all
          </div>
        </div>

        <div
          className="panel"
          onClick={() => setStatusFilter('active')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: statusFilter === 'active' ? '4px solid #10b981' : '4px solid transparent',
            background: statusFilter === 'active' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            🟢 Active Entities
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {activePublishers}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Ready for catalog assignment
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase' }}>
            🏷️ Selected Imprints
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#3730a3', marginTop: '4px' }}>
            {imprintsLoading ? '…' : imprints.length}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            For {selectedPublisher?.name || 'current publisher'}
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
            📚 Catalog Publications
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
            {totalBooks}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Active titles across publishers
          </div>
        </div>
      </div>

      {/* Master-Detail Split Layout */}
      {loading ? (
        <div className="panel empty" style={{ padding: '40px', textAlign: 'center' }}>
          Loading enterprise publishers…
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 380px) 1fr',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          {/* Left Column: Publisher Directory */}
          <div className="panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 className="section-title" style={{ margin: 0, fontSize: '16px' }}>
                Publishers Directory ({filteredPublishers.length})
              </h2>
              {canCreate && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={openNewPublisherModal}
                  title="Add new publisher"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  ➕ Add
                </button>
              )}
            </div>

            {/* Search and Filter */}
            <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                className="input"
                placeholder="🔍 Search name, code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', fontSize: '13px' }}
              />

              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'active', 'inactive'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      textTransform: 'capitalize',
                      fontSize: '11px',
                      padding: '4px 8px',
                      background: statusFilter === tab ? 'var(--primary, #4f46e5)' : undefined,
                      color: statusFilter === tab ? '#ffffff' : undefined,
                      fontWeight: statusFilter === tab ? 600 : 400,
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: 'calc(100vh - 380px)',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {filteredPublishers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: '#9ca3af', fontSize: '13px' }}>
                  No publishers match your filter.
                </div>
              ) : (
                filteredPublishers.map(pub => {
                  const isSelected = pub.id === selectedPublisherId;
                  return (
                    <div
                      key={pub.id}
                      onClick={() => setSelectedPublisherId(pub.id)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid #4f46e5' : '1px solid var(--border, #e5e7eb)',
                        background: isSelected
                          ? 'var(--panel-active-bg, #f8faff)'
                          : 'var(--panel-bg, #ffffff)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontWeight: isSelected ? 700 : 600,
                            color: isSelected ? '#1e1b4b' : 'inherit',
                            fontSize: '14px',
                          }}
                        >
                          {pub.name}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '999px',
                            textTransform: 'uppercase',
                            background: pub.status === 'active' ? '#ecfdf5' : '#fef2f2',
                            color: pub.status === 'active' ? '#065f46' : '#991b1b',
                          }}
                        >
                          {pub.status}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12px',
                          color: '#6b7280',
                        }}
                      >
                        {pub.code && (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              background: '#f3f4f6',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}
                          >
                            {pub.code}
                          </span>
                        )}
                        <span>•</span>
                        <span>{pub.book_count} {Number(pub.book_count) === 1 ? 'book' : 'books'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Publisher Workbench & Imprints */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {selectedPublisher ? (
              <>
                {/* Publisher Details Card */}
                <div className="panel" style={{ padding: '20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '16px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid var(--border, #e5e7eb)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                          {selectedPublisher.name}
                        </h2>
                        {selectedPublisher.code && (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              background: '#e0e7ff',
                              color: '#3730a3',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            {selectedPublisher.code}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            textTransform: 'uppercase',
                            background: selectedPublisher.status === 'active' ? '#ecfdf5' : '#fef2f2',
                            color: selectedPublisher.status === 'active' ? '#065f46' : '#991b1b',
                          }}
                        >
                          {selectedPublisher.status}
                        </span>
                      </div>
                      <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                        Registered publishing entity ID: <code>{selectedPublisher.id}</code>
                      </p>
                    </div>

                    {canUpdate && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => openEditPublisherModal(selectedPublisher)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>✏️</span>
                        <span>Edit Details</span>
                      </button>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '14px',
                    }}
                  >
                    <div style={{ background: '#f9fafb', padding: '12px 14px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                        Legal Corporate Name
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827', marginTop: '2px' }}>
                        {selectedPublisher.legal_name || '—'}
                      </div>
                    </div>

                    <div style={{ background: '#f9fafb', padding: '12px 14px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                        Contact Email
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827', marginTop: '2px' }}>
                        {selectedPublisher.contact_email ? (
                          <a
                            href={`mailto:${selectedPublisher.contact_email}`}
                            style={{ color: '#4f46e5', textDecoration: 'underline' }}
                          >
                            {selectedPublisher.contact_email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>

                    <div style={{ background: '#f9fafb', padding: '12px 14px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                        Official Website
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827', marginTop: '2px' }}>
                        {selectedPublisher.website ? (
                          <a
                            href={selectedPublisher.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#4f46e5', textDecoration: 'underline' }}
                          >
                            {selectedPublisher.website}
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>

                    <div style={{ background: '#f9fafb', padding: '12px 14px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                        Catalog Books
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: '#111827',
                          marginTop: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>{selectedPublisher.book_count} books</span>
                        <Link
                          href="/publishing-catalog/book-catalog-list"
                          className="btn btn-sm"
                          style={{ padding: '2px 6px', fontSize: '11px' }}
                        >
                          View in Catalog
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Imprints Section */}
                <div className="panel" style={{ padding: '20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                        Associated Imprints ({imprints.length})
                      </h3>
                      <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '12px' }}>
                        Subdivisions and imprint branding lines published under {selectedPublisher.name}.
                      </p>
                    </div>

                    {canCreate && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={openNewImprintModal}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>➕</span>
                        <span>Add Imprint</span>
                      </button>
                    )}
                  </div>

                  {imprintsLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                      Loading imprints…
                    </div>
                  ) : imprints.length === 0 ? (
                    <div
                      style={{
                        padding: '30px 20px',
                        textAlign: 'center',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px dashed #d1d5db',
                      }}
                    >
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏷️</div>
                      <div style={{ fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                        No imprints registered for this publisher
                      </div>
                      <p className="muted" style={{ fontSize: '12px', margin: '4px 0 12px 0' }}>
                        Imprints allow you to distinguish trade, academic, or niche publication divisions.
                      </p>
                      {canCreate && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={openNewImprintModal}
                        >
                          ➕ Create First Imprint
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: '120px' }}>Code</th>
                            <th>Imprint Name</th>
                            <th>Description</th>
                            <th style={{ width: '100px' }}>Status</th>
                            {canUpdate && <th style={{ width: '90px' }}>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {imprints.map(imp => (
                            <tr key={imp.id}>
                              <td>
                                {imp.code ? (
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      background: '#f3f4f6',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                    }}
                                  >
                                    {imp.code}
                                  </span>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>{imp.name}</td>
                              <td style={{ fontSize: '13px', color: '#4b5563' }}>
                                {imp.description || <span className="muted">—</span>}
                              </td>
                              <td>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '999px',
                                    textTransform: 'uppercase',
                                    background: imp.status === 'active' ? '#ecfdf5' : '#fef2f2',
                                    color: imp.status === 'active' ? '#065f46' : '#991b1b',
                                  }}
                                >
                                  {imp.status}
                                </span>
                              </td>
                              {canUpdate && (
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => openEditImprintModal(imp)}
                                    style={{ padding: '3px 8px', fontSize: '12px' }}
                                  >
                                    Edit
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="panel empty" style={{ padding: '40px', textAlign: 'center' }}>
                Select a publisher from the directory or create a new one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Publisher Modal (New / Edit) */}
      {showPublisherModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {editingPublisher ? 'Edit Publisher' : 'Register New Publisher'}
              </h3>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowPublisherModal(false)}
                style={{ padding: '2px 8px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePublisher}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label className="field">
                  <span style={{ fontWeight: 600 }}>Publisher Name *</span>
                  <input
                    className="input"
                    required
                    value={publisherForm.name}
                    onChange={e => setPublisherForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Bangladesh University Press"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Code / Identifier</span>
                    <input
                      className="input"
                      value={publisherForm.code}
                      onChange={e => setPublisherForm(prev => ({ ...prev, code: e.target.value }))}
                      placeholder="e.g. BUP-01"
                    />
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Alphanumeric, dots, dashes</span>
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Status</span>
                    <select
                      className="input"
                      value={publisherForm.status}
                      onChange={e => setPublisherForm(prev => ({ ...prev, status: e.target.value as any }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span style={{ fontWeight: 600 }}>Legal Corporate Name</span>
                  <input
                    className="input"
                    value={publisherForm.legalName}
                    onChange={e => setPublisherForm(prev => ({ ...prev, legalName: e.target.value }))}
                    placeholder="e.g. Bangladesh University Press Limited"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Contact Email</span>
                    <input
                      type="email"
                      className="input"
                      value={publisherForm.email}
                      onChange={e => setPublisherForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="editorial@publisher.com"
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Official Website</span>
                    <input
                      type="url"
                      className="input"
                      value={publisherForm.website}
                      onChange={e => setPublisherForm(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://example.com"
                    />
                  </label>
                </div>
              </div>

              <div className="button-row" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowPublisherModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !publisherForm.name.trim()}
                >
                  {busy ? 'Saving…' : editingPublisher ? 'Save Changes' : 'Create Publisher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Imprint Modal (New / Edit) */}
      {showImprintModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  {editingImprint ? 'Edit Imprint' : 'Add New Imprint'}
                </h3>
                <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '12px' }}>
                  Parent Publisher: <strong>{selectedPublisher?.name}</strong>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowImprintModal(false)}
                style={{ padding: '2px 8px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveImprint}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label className="field">
                  <span style={{ fontWeight: 600 }}>Imprint Name *</span>
                  <input
                    className="input"
                    required
                    value={imprintForm.name}
                    onChange={e => setImprintForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Academy Press / Academic Series"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Imprint Code</span>
                    <input
                      className="input"
                      value={imprintForm.code}
                      onChange={e => setImprintForm(prev => ({ ...prev, code: e.target.value }))}
                      placeholder="e.g. ACA"
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Status</span>
                    <select
                      className="input"
                      value={imprintForm.status}
                      onChange={e => setImprintForm(prev => ({ ...prev, status: e.target.value as any }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span style={{ fontWeight: 600 }}>Description / Genre Focus</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={imprintForm.description}
                    onChange={e => setImprintForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the imprint scope or targeted literary genres..."
                  />
                </label>
              </div>

              <div className="button-row" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowImprintModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !imprintForm.name.trim()}
                >
                  {busy ? 'Saving…' : editingImprint ? 'Save Changes' : 'Add Imprint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
