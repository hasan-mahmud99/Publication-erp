'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

type Spec = {
  specRef: string;
  editionId: string;
  printingMethod: string;
  interiorPages: number;
  trimWidthMm: number;
  trimHeightMm: number;
  interiorPaperGsm: number;
  interiorColors: number;
  coverPaperGsm: number;
  coverColors: number;
  bindingType: string;
  finishing: string;
  notes: string;
};

const blank = (): Spec => ({
  specRef: '',
  editionId: '',
  printingMethod: 'offset',
  interiorPages: 256,
  trimWidthMm: 148,
  trimHeightMm: 210,
  interiorPaperGsm: 80,
  interiorColors: 1,
  coverPaperGsm: 300,
  coverColors: 4,
  bindingType: 'perfect',
  finishing: 'Matte Lamination',
  notes: 'Standard trade paperback physical specification',
});

// Industry Standard Specification Presets
const PRESETS: { name: string; icon: string; desc: string; data: Partial<Spec> }[] = [
  {
    name: 'Standard Paperback (A5)',
    icon: '📘',
    desc: 'Trade paperback: 148×210 mm, 80 GSM Book Paper, 1-Color text, 300 GSM Artcard cover, Perfect binding',
    data: {
      printingMethod: 'offset',
      trimWidthMm: 148,
      trimHeightMm: 210,
      interiorPaperGsm: 80,
      interiorColors: 1,
      coverPaperGsm: 300,
      coverColors: 4,
      bindingType: 'perfect',
      finishing: 'Matte Lamination, Creasing',
    },
  },
  {
    name: 'Academic Textbook (Crown 4to)',
    icon: '🎓',
    desc: 'University textbook: 189×246 mm, 70 GSM White Offset, 2-Color, 260 GSM Card, Perfect binding',
    data: {
      printingMethod: 'offset',
      trimWidthMm: 189,
      trimHeightMm: 246,
      interiorPaperGsm: 70,
      interiorColors: 2,
      coverPaperGsm: 260,
      coverColors: 4,
      bindingType: 'perfect',
      finishing: 'Gloss Lamination, Side-sewn reinforcement',
    },
  },
  {
    name: 'Deluxe Hardcover (Royal 8vo)',
    icon: '👑',
    desc: 'Collector edition: 156×234 mm, 100 GSM Cream, 4-Color, 350 GSM Board, Hardcover Casebound, Gold foil',
    data: {
      printingMethod: 'offset',
      trimWidthMm: 156,
      trimHeightMm: 234,
      interiorPaperGsm: 100,
      interiorColors: 4,
      coverPaperGsm: 350,
      coverColors: 4,
      bindingType: 'hardcover',
      finishing: 'Hardcover Case Binding, Gold Foil Stamping, Ribbon Marker, Head & Tail Bands',
    },
  },
  {
    name: 'Compact Digest / Booklet (B6)',
    icon: '📑',
    desc: 'Pocket size: 125×176 mm, 65 GSM Newsprint/Offset, 1-Color, 210 GSM Duplex, Saddle Stitch',
    data: {
      printingMethod: 'digital',
      trimWidthMm: 125,
      trimHeightMm: 176,
      interiorPaperGsm: 65,
      interiorColors: 1,
      coverPaperGsm: 210,
      coverColors: 2,
      bindingType: 'saddle_stitch',
      finishing: 'Wire Saddle Stitching, Single Trimming',
    },
  },
];

const label = (value: string) => String(value || '').replaceAll('_', ' ');

export function ProductionSpecScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editions, setEditions] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [form, setForm] = useState<Spec>(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // UI States
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const canManage = role === 'Owner' || permissions.includes('production.manage');
  const canApprove = role === 'Owner' || permissions.includes('production.approve');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [list, choices, me] = await Promise.all([
        api<{ data: Row[] }>('/production/specifications'),
        api<{ data: { editions: Row[] } }>('/production/choices'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);
      setRows(list.data || []);
      setEditions(choices.data?.editions || []);
      setRole(me.data.role);
      setPermissions(me.data.permissions || []);

      // If rows exist and none selected, auto-select the first one for fast detail preview
      if (!detail && list.data?.length > 0) {
        await select(list.data[0].id);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load specifications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [screen.id]);

  async function select(id: string) {
    setFormOpen(false);
    setError('');
    try {
      const res = await api<{ data: Row }>(`/production/specifications/${id}`);
      setDetail(res.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load specification');
    }
  }

  function startCreate() {
    setDetail(null);
    const orderRefNumber = `SPEC-PO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    setForm({
      ...blank(),
      specRef: orderRefNumber,
      editionId: editions.length > 0 ? editions[0].id : '',
    });
    setFormOpen(true);
    setNotice('');
  }

  function startEdit() {
    if (!detail) return;
    setForm({
      ...blank(),
      ...(detail.currentVersion?.terms || {}),
      specRef: detail.reference,
      editionId: detail.edition_id,
    });
    setFormOpen(true);
  }

  function applyPreset(presetData: Partial<Spec>) {
    setForm(curr => ({ ...curr, ...presetData }));
    setNotice(`Applied preset parameters.`);
  }

  function change<K extends keyof Spec>(key: K, value: Spec[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  // Calculate estimated physical spine width (mm)
  const calculatedSpineMm = useMemo(() => {
    const pages = Number(form.interiorPages) || 0;
    const gsm = Number(form.interiorPaperGsm) || 80;
    const coverGsm = Number(form.coverPaperGsm) || 300;
    if (pages <= 0) return 0;
    // Standard spine formula: (Pages / 2) * (GSM / 1000 * 1.2 page bulk factor) + (cover allowance)
    const interiorBulk = (pages / 2) * ((gsm / 1000) * 1.25);
    const coverAllowance = form.bindingType === 'hardcover' ? 3.5 : (coverGsm / 1000) * 1.2;
    return Math.max(1, Math.round((interiorBulk + coverAllowance) * 10) / 10);
  }, [form.interiorPages, form.interiorPaperGsm, form.coverPaperGsm, form.bindingType]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const current = detail?.currentVersion;
      const path = !detail
        ? '/production/specifications'
        : current.status === 'draft'
        ? `/production/specifications/${detail.id}/versions/${current.id}`
        : `/production/specifications/${detail.id}/amendments`;
      const method = !detail || current.status !== 'draft' ? 'POST' : 'PATCH';
      const result = await api<{ data: Row }>(path, {
        method,
        body: JSON.stringify({
          ...form,
          ...(method === 'PATCH' ? { revisionNo: current.revision_no } : {}),
        }),
      });
      setDetail(result.data);
      setFormOpen(false);
      setNotice('Specification saved successfully. Submit and approve before creating print orders.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save specification');
    } finally {
      setBusy(false);
    }
  }

  async function action(kind: 'submit' | 'approve' | 'return') {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const decisionNote = note.trim() || 'Approved: Physical print specification adheres to offset pre-press standards.';
      const res = await api<{ data: Row }>(
        `/production/specifications/${detail.id}/versions/${detail.currentVersion.id}/${kind}`,
        {
          method: 'POST',
          body: JSON.stringify(kind === 'submit' ? {} : { note: decisionNote }),
        }
      );
      setDetail(res.data);
      setNote('');
      setNotice(
        `Specification ${kind === 'return' ? 'returned to draft' : kind === 'approve' ? 'approved & ready for print orders' : 'submitted for approval'}.`
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete specification action');
    } finally {
      setBusy(false);
    }
  }

  // Filtered list of specifications
  const filteredRows = useMemo(() => {
    return rows.filter(item => {
      const matchesSearch =
        !searchQuery ||
        String(item.reference || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.book_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.edition_number || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = rows.length;
    const approved = rows.filter(r => r.status === 'approved').length;
    const pending = rows.filter(r => r.status === 'pending_approval').length;
    const draft = rows.filter(r => r.status === 'draft').length;
    return { total, approved, pending, draft };
  }, [rows]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            <Link href="/printing-production/print-order-list" style={{ color: '#2563eb', textDecoration: 'none' }}>
              ← Print Orders
            </Link>
            <span style={{ color: '#94a3b8' }}>/</span>
            <Link href="/printing-production/bom-and-material-requirement" style={{ color: '#2563eb', textDecoration: 'none' }}>
              BOM & Materials
            </Link>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ color: '#64748b' }}>Physical Specifications</span>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>📐</span> Print Specification Sheet
          </h1>
          <p className="muted" style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Versioned physical specifications, trim dimensions, paper stock, and binding methods tied to book editions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void load()}
            disabled={loading}
            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155' }}
          >
            🔄 Refresh
          </button>
          <Link
            href="/printing-production/bom-and-material-requirement"
            className="btn"
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', textDecoration: 'none', fontWeight: 600 }}
          >
            📋 BOM & Materials ➔
          </Link>
          <Link
            href="/printing-production/create-print-order"
            className="btn"
            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}
          >
            🖨️ Create Print Order ➔
          </Link>
          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={startCreate}
              style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, padding: '0.55rem 1.25rem', borderRadius: '6px' }}
            >
              + Create specification
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#dcfce7', border: '1px solid #4ade80', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ {notice}</span>
          <button type="button" onClick={() => setNotice('')} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Top Metric KPI Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Print Specifications</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
            {stats.total.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Master specification records registered</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Approved (Order-Ready)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', margin: '0.25rem 0' }}>
            {stats.approved.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Active for print order planning & press runs</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>Pending QA Approval</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', margin: '0.25rem 0' }}>
            {stats.pending.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>Awaiting pre-press technical signoff</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Drafts in Queue</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', margin: '0.25rem 0' }}>
            {stats.draft.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#d97706' }}>In-progress physical specifications</div>
        </div>
      </section>

      {/* Create / Edit Form Modal / Card */}
      {formOpen && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', border: '2px solid #3b82f6', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {detail ? (detail.currentVersion?.status === 'approved' ? '📝 Amend Approved Specification (New Version)' : '✏️ Edit Specification Draft') : '⚡ Create New Print Specification'}
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                Specify exact trim size, paper GSM, color counts, and binding techniques required by the press floor.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setFormOpen(false)}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '6px', fontSize: '0.8rem' }}
            >
              ✕ Cancel
            </button>
          </div>

          {/* 1-Click Industry Standards Presets */}
          <div style={{ marginBottom: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ⚡ 1-Click Physical Format Presets:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.6rem' }}>
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p.data)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
                >
                  <span style={{ fontSize: '1.25rem' }}>{p.icon}</span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.825rem', color: '#0f172a' }}>{p.name}</strong>
                    <span style={{ fontSize: '0.725rem', color: '#64748b', lineHeight: 1.3, display: 'block' }}>{p.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Reference *
                </label>
                <input
                  className="input"
                  required
                  value={form.specRef}
                  disabled={!!detail}
                  onChange={e => change('specRef', e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Target Book Edition *
                </label>
                <select
                  className="input"
                  required
                  value={form.editionId}
                  disabled={!!detail}
                  onChange={e => change('editionId', e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
                >
                  <option value="">Choose print edition</option>
                  {editions.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.book_title} · Edition {item.edition_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Printing Method *
                </label>
                <select
                  className="input"
                  value={form.printingMethod}
                  onChange={e => change('printingMethod', e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="offset">Offset (Sheetfed / Web)</option>
                  <option value="digital">Digital Production</option>
                  <option value="screen">Screen Printing</option>
                  <option value="other">Other Specialized</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', marginBottom: '0.35rem' }}>
                  Interior pages *
                </label>
                <input
                  className="input"
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={form.interiorPages}
                  onChange={e => change('interiorPages', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #93c5fd', fontWeight: 700, color: '#1e40af' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Trim width (mm) *
                </label>
                <input
                  className="input"
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={form.trimWidthMm}
                  onChange={e => change('trimWidthMm', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Trim height (mm) *
                </label>
                <input
                  className="input"
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={form.trimHeightMm}
                  onChange={e => change('trimHeightMm', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Interior paper GSM *
                </label>
                <input
                  className="input"
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={form.interiorPaperGsm}
                  onChange={e => change('interiorPaperGsm', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Interior colors *
                </label>
                <select
                  className="input"
                  value={form.interiorColors}
                  onChange={e => change('interiorColors', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value={1}>1 Color (Black & White)</option>
                  <option value={2}>2 Color (Spot Duotone)</option>
                  <option value={4}>4 Color (CMYK Full Color)</option>
                  <option value={5}>5 Color (CMYK + Spot)</option>
                  <option value={6}>6 Color</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Cover paper GSM *
                </label>
                <input
                  className="input"
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={form.coverPaperGsm}
                  onChange={e => change('coverPaperGsm', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Cover colors *
                </label>
                <select
                  className="input"
                  value={form.coverColors}
                  onChange={e => change('coverColors', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value={4}>4 Color (CMYK Process)</option>
                  <option value={5}>5 Color (CMYK + Panton Spot)</option>
                  <option value={2}>2 Color</option>
                  <option value={1}>1 Color</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Binding *
                </label>
                <select
                  className="input"
                  value={form.bindingType}
                  onChange={e => change('bindingType', e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="perfect">Perfect Binding (Hotmelt / PUR)</option>
                  <option value="saddle_stitch">Saddle Stitch (Center wire)</option>
                  <option value="hardcover">Hardcover (Casebound Board)</option>
                  <option value="spiral">Spiral / Wire-O</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Finishing & Lamination
                </label>
                <input
                  className="input"
                  value={form.finishing}
                  onChange={e => change('finishing', e.target.value)}
                  placeholder="e.g. Matte Lamination, Spot UV, Creasing"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            {/* Calculated Spine Thickness Preview */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div>
                <strong style={{ color: '#1e40af' }}>📏 Auto-Calculated Bulk & Spine Width: </strong>
                <span style={{ color: '#1d4ed8' }}>
                  ~<strong>{calculatedSpineMm} mm</strong> (based on {form.interiorPages} pages of {form.interiorPaperGsm} GSM stock + {label(form.bindingType)})
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600 }}>
                Trim Ratio: {form.trimWidthMm} × {form.trimHeightMm} mm
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Technical Notes & Tolerances
              </label>
              <textarea
                className="input"
                rows={2}
                value={form.notes || ''}
                onChange={e => change('notes', e.target.value)}
                placeholder="Specific instructions for prepress, imposition, plate curves, or folding..."
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '1.25rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setFormOpen(false)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '6px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
                style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, padding: '0.55rem 1.5rem', borderRadius: '6px' }}
              >
                {busy ? 'Saving...' : 'Save Draft Specification'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Selected Specification Detail Card */}
      {detail && !formOpen && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {detail.reference}
                </h2>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '50px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background:
                      detail.currentVersion.status === 'approved'
                        ? '#dcfce7'
                        : detail.currentVersion.status === 'pending_approval'
                        ? '#eff6ff'
                        : '#fef3c7',
                    color:
                      detail.currentVersion.status === 'approved'
                        ? '#166534'
                        : detail.currentVersion.status === 'pending_approval'
                        ? '#1e40af'
                        : '#92400e',
                  }}
                >
                  {detail.currentVersion.status === 'approved' ? '🟢 Approved for Orders' : label(detail.currentVersion.status)}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  Version {detail.currentVersion.version_no}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                Book: <strong>{detail.book_title}</strong> · Edition <strong>{detail.edition_number}</strong>
              </p>
            </div>

            {/* Next Steps & Workflow Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {canManage && ['draft', 'approved'].includes(detail.currentVersion.status) && (
                <button
                  type="button"
                  className="btn"
                  onClick={startEdit}
                  style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  {detail.currentVersion.status === 'draft' ? '✏️ Edit Draft' : '📝 Create Amendment (v' + (detail.currentVersion.version_no + 1) + ')'}
                </button>
              )}

              {canManage && detail.currentVersion.status === 'draft' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void action('submit')}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', padding: '0.45rem 1rem', borderRadius: '5px' }}
                >
                  🚀 Submit for Approval
                </button>
              )}

              {detail.currentVersion.status === 'approved' && (
                <>
                  <Link
                    href="/printing-production/bom-and-material-requirement"
                    className="btn"
                    style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', fontWeight: 700, fontSize: '0.8rem', padding: '0.45rem 0.85rem', textDecoration: 'none', borderRadius: '5px' }}
                  >
                    📋 View / Create BOM ➔
                  </Link>
                  <Link
                    href="/printing-production/create-print-order"
                    className="btn btn-primary"
                    style={{ background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', padding: '0.45rem 1rem', textDecoration: 'none', borderRadius: '5px' }}
                  >
                    🖨️ Create Print Order with this Spec ➔
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Physical Parameters Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Trim Size & Format</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a', marginTop: '0.2rem' }}>
                {detail.currentVersion.terms.trimWidthMm} × {detail.currentVersion.terms.trimHeightMm} mm
              </strong>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Method: {label(detail.currentVersion.terms.printingMethod)}
              </span>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Interior Paper & Pages</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a', marginTop: '0.2rem' }}>
                {detail.currentVersion.terms.interiorPages} pages · {detail.currentVersion.terms.interiorPaperGsm} GSM
              </strong>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Interior colors: {detail.currentVersion.terms.interiorColors} color(s)
              </span>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Cover Paper & Color</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a', marginTop: '0.2rem' }}>
                {detail.currentVersion.terms.coverPaperGsm} GSM Card
              </strong>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Cover colors: {detail.currentVersion.terms.coverColors} color process
              </span>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Binding & Finishing</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a', marginTop: '0.2rem' }}>
                {label(detail.currentVersion.terms.bindingType)}
              </strong>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {detail.currentVersion.terms.finishing || 'Standard trimming'}
              </span>
            </div>
          </div>

          {/* Pre-press Approval Card if in pending_approval */}
          {canApprove && detail.currentVersion.status === 'pending_approval' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                ✍️ Pre-Press Quality Approval Decision
              </div>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#78350f' }}>
                Independent approval verifies that physical trim sizes, imposition margins, and paper GSM meet press standards before print orders can be scheduled.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  className="input"
                  style={{ flex: 1, padding: '0.45rem 0.75rem', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  placeholder="Decision note (min 10 characters required)"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => setNote('Approved: Physical print specification adheres to offset pre-press standards.')}
                  style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderRadius: '4px' }}
                >
                  ⚡ Fast Pre-fill Note
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || note.trim().length < 10}
                  onClick={() => void action('return')}
                  style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', fontWeight: 600, fontSize: '0.8rem', padding: '0.4rem 0.85rem', borderRadius: '4px' }}
                >
                  ↩️ Return to Draft
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || note.trim().length < 10}
                  onClick={() => void action('approve')}
                  style={{ background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', padding: '0.4rem 1.25rem', borderRadius: '4px' }}
                >
                  {busy ? 'Processing...' : '✅ Approve Specification'}
                </button>
              </div>
            </div>
          )}

          {/* Version History List */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', margin: '0 0 0.5rem 0' }}>
              📜 Version & Amendment History ({detail.versions?.length || 1})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {(detail.versions || []).map((item: Row) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: item.id === detail.currentVersion.id ? '#f1f5f9' : '#fff',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <strong style={{ color: '#0f172a' }}>Version {item.version_no}</strong>
                    <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>
                      ({item.status === 'approved' ? '🟢 Approved' : label(item.status)})
                    </span>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>ID: {item.id}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Specifications Register Table */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Table Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              📋 Print Specifications Register ({filteredRows.length})
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Select any specification to inspect physical parameters or amend versions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              className="input"
              type="text"
              placeholder="Search reference or book title..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
            <select
              className="input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved Only</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="draft">Drafts Only</option>
            </select>
          </div>
        </div>

        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Reference</th>
                <th style={{ padding: '0.75rem 1rem' }}>Book / Edition</th>
                <th style={{ padding: '0.75rem 1rem' }}>Method</th>
                <th style={{ padding: '0.75rem 1rem' }}>Trim Size</th>
                <th style={{ padding: '0.75rem 1rem' }}>Pages & GSM</th>
                <th style={{ padding: '0.75rem 1rem' }}>Version</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    Loading specifications…
                  </td>
                </tr>
              ) : filteredRows.length > 0 ? (
                filteredRows.map(item => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: detail?.id === item.id ? '#f0f9ff' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      {item.reference}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                      {item.book_title} · Ed. {item.edition_number}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                      {label(item.terms?.printingMethod || 'offset')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 600 }}>
                      {item.terms?.trimWidthMm} × {item.terms?.trimHeightMm} mm
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                      {item.terms?.interiorPages} pp ({item.terms?.interiorPaperGsm} GSM)
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                      v{item.version_no}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background:
                            item.status === 'approved'
                              ? '#dcfce7'
                              : item.status === 'pending_approval'
                              ? '#eff6ff'
                              : '#fef3c7',
                          color:
                            item.status === 'approved'
                              ? '#166534'
                              : item.status === 'pending_approval'
                              ? '#1e40af'
                              : '#92400e',
                        }}
                      >
                        {item.status === 'approved' ? '🟢 Approved' : label(item.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void select(item.id)}
                        style={{
                          background: detail?.id === item.id ? '#2563eb' : '#f8fafc',
                          color: detail?.id === item.id ? '#fff' : '#334155',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.35rem 0.65rem',
                          borderRadius: '4px',
                        }}
                      >
                        {detail?.id === item.id ? '✓ Selected' : 'Details'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    No print specifications found for this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
