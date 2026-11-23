"use client";

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Category = {
  id: string;
  code: string | null;
  name_en: string;
  parent_id: string | null;
  parent_name: string | null;
  description: string | null;
  sort_order: number;
  status: 'active' | 'inactive';
  book_count: number;
};

type Form = {
  code: string;
  name: string;
  parentId: string;
  description: string;
  sortOrder: string;
  status: 'active' | 'inactive';
};

const blankForm: Form = {
  code: '',
  name: '',
  parentId: '',
  description: '',
  sortOrder: '0',
  status: 'active',
};

export function CategoryScreen({ screen }: { screen: Screen }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'root' | 'sub' | 'active'>('all');

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<Form>(blankForm);

  // Quick Add Parent Modal State
  const [showAddParentModal, setShowAddParentModal] = useState(false);
  const [newParentName, setNewParentName] = useState('');
  const [newParentCode, setNewParentCode] = useState('');

  // Permissions & State
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');

  async function load() {
    const result = await api<{ data: Category[] }>('/categories');
    setCategories(result.data);
  }

  useEffect(() => {
    void Promise.all([load(), api<{ data: { role: string; permissions: string[] } }>('/auth/me')])
      .then(([, me]) => {
        setRole(me.data.role);
        setPermissions(me.data.permissions);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load categories'))
      .finally(() => setLoading(false));
  }, []);

  // Filtered categories
  const filtered = useMemo(() => {
    return categories.filter(item => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        item.name_en.toLowerCase().includes(q) ||
        (item.parent_name && item.parent_name.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q));

      if (!matchesQuery) return false;

      if (filterType === 'root') return !item.parent_id;
      if (filterType === 'sub') return Boolean(item.parent_id);
      if (filterType === 'active') return item.status === 'active';
      return true;
    });
  }, [categories, query, filterType]);

  // Aggregate stats
  const totalCategories = categories.length;
  const rootCategories = categories.filter(c => !c.parent_id).length;
  const subCategories = categories.filter(c => Boolean(c.parent_id)).length;
  const totalAssignedBooks = categories.reduce((acc, c) => acc + (Number(c.book_count) || 0), 0);

  // Modal Openers
  function openCreateModal(defaultParentId = '') {
    setEditingCategory(null);
    setForm({
      ...blankForm,
      parentId: defaultParentId,
    });
    setError('');
    setShowModal(true);
  }

  function openEditModal(item: Category) {
    setEditingCategory(item);
    setForm({
      code: item.code || '',
      name: item.name_en,
      parentId: item.parent_id || '',
      description: item.description || '',
      sortOrder: String(item.sort_order),
      status: item.status,
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        parentId: form.parentId || null,
        description: form.description.trim() || null,
        sortOrder: Number(form.sortOrder),
        status: form.status,
      };

      if (editingCategory) {
        await api(`/categories/${editingCategory.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setNotice(`Category "${form.name.trim()}" updated successfully.`);
      } else {
        await api('/categories', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setNotice(`Category "${form.name.trim()}" created successfully.`);
      }

      await load();
      setShowModal(false);
      setEditingCategory(null);
      setForm(blankForm);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save category');
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickAddParent() {
    if (!newParentName.trim()) return;
    setBusy(true);
    setError('');

    try {
      const generatedCode =
        newParentCode.trim() ||
        newParentName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 30);

      const res = await api<{ data: { id: string } }>('/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: newParentName.trim(),
          code: generatedCode,
          parentId: null,
          status: 'active',
        }),
      });

      await load();
      setForm(cur => ({ ...cur, parentId: res.data.id }));
      setShowAddParentModal(false);
      setNewParentName('');
      setNewParentCode('');
      setNotice(`Root category "${newParentName.trim()}" created and selected.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create root category');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Maintain the taxonomy hierarchy, BISAC/Dewey subject mappings, and classification trees for catalog books.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openCreateModal()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>➕</span>
              <span>New Category</span>
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => void load().catch(reason => setError(reason.message))}
          >
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
          onClick={() => setFilterType('all')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: filterType === 'all' ? '4px solid #4f46e5' : '4px solid transparent',
            background: filterType === 'all' ? 'var(--panel-active-bg, #f5f3ff)' : undefined,
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            📁 Total Categories
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalCategories}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Click to view all taxonomy
          </div>
        </div>

        <div
          className="panel"
          onClick={() => setFilterType('root')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: filterType === 'root' ? '4px solid #0284c7' : '4px solid transparent',
            background: filterType === 'root' ? 'var(--panel-active-bg, #f0f9ff)' : undefined,
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0369a1', textTransform: 'uppercase' }}>
            🌳 Root Categories
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0c4a6e', marginTop: '4px' }}>
            {rootCategories}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Top-level parent divisions
          </div>
        </div>

        <div
          className="panel"
          onClick={() => setFilterType('sub')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: filterType === 'sub' ? '4px solid #10b981' : '4px solid transparent',
            background: filterType === 'sub' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            🌿 Sub-Categories
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {subCategories}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Specialized subject classifications
          </div>
        </div>

        <div className="panel" style={{ padding: '16px 20px', borderLeft: '4px solid #d97706' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>
            📚 Catalog Assignments
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#78350f', marginTop: '4px' }}>
            {totalAssignedBooks}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Titles linked to classifications
          </div>
        </div>
      </div>

      {/* Main Table & Filter Controls */}
      {loading ? (
        <div className="panel empty" style={{ padding: '40px', textAlign: 'center' }}>
          Loading category taxonomy…
        </div>
      ) : (
        <div className="panel" style={{ padding: '20px' }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
              <input
                className="input"
                aria-label="Search categories"
                placeholder="🔍 Search by code, name, parent category, or subject..."
                value={query}
                onChange={event => setQuery(event.target.value)}
                style={{ width: '100%', maxWidth: '420px', fontSize: '13px' }}
              />

              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'root', 'sub', 'active'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterType(tab)}
                    className="btn btn-sm"
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      textTransform: 'capitalize',
                      background: filterType === tab ? '#4f46e5' : undefined,
                      color: filterType === tab ? '#ffffff' : undefined,
                      fontWeight: filterType === tab ? 700 : 400,
                    }}
                  >
                    {tab === 'all'
                      ? 'All'
                      : tab === 'root'
                      ? 'Root Only'
                      : tab === 'sub'
                      ? 'Subcategories'
                      : 'Active'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Showing {filtered.length} of {categories.length}
              </span>
              {canCreate && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => openCreateModal()}
                >
                  ➕ New Category
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Code</th>
                  <th>Category Name</th>
                  <th style={{ width: '190px' }}>Hierarchy Level</th>
                  <th style={{ width: '120px' }}>Assigned Books</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Sort</th>
                  <th style={{ width: '160px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map(item => {
                    const isRoot = !item.parent_id;
                    return (
                      <tr key={item.id}>
                        <td>
                          <code
                            style={{
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                            }}
                          >
                            {item.code || '—'}
                          </code>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                            {item.name_en}
                          </div>
                          {item.description && (
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', lineHeight: 1.35 }}>
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: isRoot ? '#eff6ff' : '#f8fafc',
                              color: isRoot ? '#1d4ed8' : '#475569',
                              border: isRoot ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                            }}
                          >
                            {isRoot ? '🌳 Root Category' : `🌿 Sub of: ${item.parent_name}`}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: Number(item.book_count) > 0 ? '#ecfdf5' : '#f3f4f6',
                              color: Number(item.book_count) > 0 ? '#065f46' : '#6b7280',
                            }}
                          >
                            {item.book_count} {Number(item.book_count) === 1 ? 'book' : 'books'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '999px',
                              textTransform: 'uppercase',
                              background: item.status === 'active' ? '#ecfdf5' : '#fef2f2',
                              color: item.status === 'active' ? '#065f46' : '#991b1b',
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                          {item.sort_order}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {canUpdate && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => openEditModal(item)}
                                style={{ padding: '3px 8px', fontSize: '12px' }}
                              >
                                ✏️ Edit
                              </button>
                            )}
                            {canCreate && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => openCreateModal(item.id)}
                                title={`Add subcategory under ${item.name_en}`}
                                style={{ padding: '3px 8px', fontSize: '12px' }}
                              >
                                ➕ Sub
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="empty" style={{ padding: '30px', textAlign: 'center' }}>
                      No categories match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dialog: Create / Edit Category */}
      {showModal && (
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
          onClick={e => {
            if (e.target === e.currentTarget) setShowModal(false);
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
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {editingCategory ? `✏️ Edit Category: ${editingCategory.name_en}` : '➕ Create New Category'}
              </h3>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowModal(false)}
                style={{ padding: '2px 8px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>
                      Code / Taxonomy Key <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                    <input
                      className="input"
                      required
                      maxLength={80}
                      placeholder="e.g. FICTION_NOVEL"
                      value={form.code}
                      onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                    />
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Alphanumeric, underscores, hyphens</span>
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Status</span>
                    <select
                      className="input"
                      value={form.status}
                      onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span style={{ fontWeight: 600 }}>
                    Category Name <span style={{ color: '#dc2626' }}>*</span>
                  </span>
                  <input
                    className="input"
                    required
                    maxLength={255}
                    placeholder="e.g. Contemporary Fiction"
                    value={form.name}
                    onChange={e => {
                      const name = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        name,
                        code: editingCategory ? prev.code : prev.code || name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 30),
                      }));
                    }}
                  />
                </label>

                {/* Parent Category with PLUS button */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>Parent Category (Hierarchy Level)</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      className="input"
                      value={form.parentId}
                      onChange={e => setForm(prev => ({ ...prev, parentId: e.target.value }))}
                      style={{ flex: 1 }}
                    >
                      <option value="">-- Root Level Category (No Parent) --</option>
                      {categories
                        .filter(c => (!editingCategory || c.id !== editingCategory.id) && c.status === 'active')
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name_en} ({c.code || 'No code'})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setShowAddParentModal(true);
                        setNewParentName('');
                        setNewParentCode('');
                      }}
                      title="Add new root category"
                      style={{ whiteSpace: 'nowrap', padding: '6px 10px', fontWeight: 700 }}
                    >
                      ➕
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    Select a parent to nest as a sub-classification, or leave blank for root.
                  </span>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Sort Order</span>
                    <input
                      type="number"
                      min="0"
                      max="99999"
                      className="input"
                      value={form.sortOrder}
                      onChange={e => setForm(prev => ({ ...prev, sortOrder: e.target.value }))}
                    />
                  </label>
                </div>

                <label className="field">
                  <span style={{ fontWeight: 600 }}>Description / Subject Scope</span>
                  <textarea
                    className="input"
                    rows={3}
                    maxLength={1000}
                    placeholder="Brief description of the literary or academic scope of this category..."
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </label>
              </div>

              <div
                className="button-row"
                style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !form.code.trim() || !form.name.trim()}
                >
                  {busy ? 'Saving…' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Parent Category Modal */}
      {showAddParentModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setShowAddParentModal(false);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                ➕ Create New Root Category
              </h3>
              <button
                type="button"
                onClick={() => setShowAddParentModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <label className="field">
                <span>
                  Category Name <span style={{ color: '#dc2626' }}>*</span>
                </span>
                <input
                  className="input"
                  autoFocus
                  placeholder="e.g. Science & Technology"
                  value={newParentName}
                  onChange={e => setNewParentName(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Category Code (optional)</span>
                <input
                  className="input"
                  placeholder="e.g. SCI_TECH"
                  value={newParentCode}
                  onChange={e => setNewParentCode(e.target.value)}
                />
              </label>
            </div>
            <div className="button-row" style={{ marginTop: '20px', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn" onClick={() => setShowAddParentModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !newParentName.trim()}
                onClick={() => void handleQuickAddParent()}
              >
                Create &amp; Select
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
