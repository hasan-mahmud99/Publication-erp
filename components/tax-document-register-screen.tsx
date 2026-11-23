'use client';

import { useEffect, useState, useId } from 'react';
import { api } from '@/lib/api';
import {
  FileText,
  Printer,
  Search,
  Filter,
  Plus,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Building,
  Calendar,
  Truck,
  ShieldCheck,
  QrCode,
} from 'lucide-react';

type TaxDocument = {
  id: string;
  document_type: string;
  document_number: string;
  issue_date: string;
  reference_type: string | null;
  reference_number: string | null;
  party_type: string;
  party_name: string;
  party_bin_tin: string | null;
  taxable_amount: string | number;
  tax_amount: string | number;
  vds_amount: string | number;
  status: string;
  details_json: any;
  created_at: string;
};

function normalizeDoc(d: any): TaxDocument {
  const details = typeof d.details_json === 'string' ? JSON.parse(d.details_json || '{}') : (d.details_json || {});
  const docType = d.doc_type || d.document_type || 'mushak_6_3';
  return {
    id: d.id,
    document_type: docType,
    document_number: d.doc_number || d.document_number || '',
    issue_date: d.issue_date ? String(d.issue_date).slice(0, 10) : '',
    reference_type: d.source_type || d.reference_type || null,
    reference_number: d.source_id || d.reference_number || null,
    party_type: d.party_type || (docType === 'mushak_6_6' ? 'Supplier' : (docType === 'mushak_6_5' ? 'Internal Depot/Fair' : 'Customer')),
    party_name: d.recipient_name || d.party_name || '-',
    party_bin_tin: d.recipient_bin_tin || d.party_bin_tin || null,
    taxable_amount: d.total_taxable_amount ?? d.taxable_amount ?? 0,
    tax_amount: d.total_tax_amount ?? d.tax_amount ?? 0,
    vds_amount: d.vds_amount ?? details.vds_amount ?? details.vdsDeductedAmount ?? (docType === 'mushak_6_6' ? (d.total_tax_amount ?? 0) : 0),
    status: d.status || 'issued',
    details_json: details,
    created_at: d.created_at || '',
  };
}

type TaxConfig = {
  bin_number: string;
  legal_name: string;
  trade_name: string;
  tax_circle: string;
  tax_zone: string;
  commissionerate: string;
  division: string;
};

export function TaxDocumentRegisterScreen() {
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [config, setConfig] = useState<TaxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Filters
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [viewDoc, setViewDoc] = useState<TaxDocument | null>(null);
  const [showMushak65Modal, setShowMushak65Modal] = useState(false);
  const [showMushak66Modal, setShowMushak66Modal] = useState(false);

  // Form states for Mushak 6.5 (Transfer Challan)
  const [m65TransferDate, setM65TransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [m65FromLocation, setM65FromLocation] = useState('Central Warehouse, Bangla Bazar, Dhaka');
  const [m65ToLocation, setM65ToLocation] = useState('Ekushey Boi Mela Stall #42, Suhrawardy Udyan, Dhaka');
  const [m65VehicleType, setM65VehicleType] = useState('Covered Van (Pickup)');
  const [m65VehicleNumber, setM65VehicleNumber] = useState('Dhaka Metro-U-11-2345');
  const [m65DriverName, setM65DriverName] = useState('Mohammad Rafiq');
  const [m65DriverPhone, setM65DriverPhone] = useState('+8801711223344');
  const [m65Items, setM65Items] = useState([
    { bookTitle: 'Bangla Sahitya Itihas (Vol 1)', hsCode: '4901.99.00', quantity: 200, estimatedValue: 80000 },
    { bookTitle: 'Adhunik Kobita Somogro', hsCode: '4901.99.00', quantity: 150, estimatedValue: 60000 },
  ]);

  // Form states for Mushak 6.6 (VDS Certificate)
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [m66SupplierId, setM66SupplierId] = useState('');
  const [m66InvoiceNumber, setM66InvoiceNumber] = useState('');
  const [m66InvoiceDate, setM66InvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [m66BillAmount, setM66BillAmount] = useState('');
  const [m66VatAmount, setM66VatAmount] = useState('');
  const [m66VdsDeducted, setM66VdsDeducted] = useState('');
  const [m66TreasuryChallan, setM66TreasuryChallan] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [docsRes, cfgRes, suppRes] = await Promise.all([
        api<{ data: any }>('/tax/documents'),
        api<{ data: TaxConfig }>('/tax/configuration'),
        api<{ data: { data: any[] } }>('/procurement/suppliers?limit=100').catch(() => ({ data: { data: [] } })),
      ]);
      const rawDocs = docsRes.data?.rows || (Array.isArray(docsRes.data) ? docsRes.data : []);
      const parsedDocs = Array.isArray(rawDocs) ? rawDocs.map(normalizeDoc) : [];
      setDocuments(parsedDocs);
      setConfig(cfgRes.data || null);
      setSuppliers(suppRes.data?.data || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load tax documents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateMushak65(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: any }>('/tax/documents/mushak-6-5', {
        method: 'POST',
        body: JSON.stringify({
          transferDate: m65TransferDate,
          fromLocation: m65FromLocation,
          toLocation: m65ToLocation,
          vehicleType: m65VehicleType,
          vehicleNumber: m65VehicleNumber,
          driverName: m65DriverName,
          driverPhone: m65DriverPhone,
          items: m65Items,
        }),
      });
      const docNum = res.data?.docNumber || res.data?.document_number || 'Transfer Challan';
      setNotice(`Mushak 6.5 transfer challan ${docNum} issued successfully.`);
      setShowMushak65Modal(false);
      await loadData();
      if (res.data?.id) {
        try {
          const fullDoc = await api<{ data: any }>(`/tax/documents/${res.data.id}`);
          if (fullDoc.data) {
            setViewDoc(normalizeDoc(fullDoc.data));
          }
        } catch {}
      }
    } catch (err: any) {
      setError(err?.message || 'Could not issue Mushak 6.5 Challan');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateMushak66(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: any }>('/tax/documents/mushak-6-6', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: m66SupplierId,
          supplierInvoiceNumber: m66InvoiceNumber,
          invoiceDate: m66InvoiceDate,
          totalBillAmount: Number(m66BillAmount),
          vatAmount: Number(m66VatAmount),
          vdsDeductedAmount: Number(m66VdsDeducted),
          treasuryChallanNo: m66TreasuryChallan,
        }),
      });
      const docNum = res.data?.docNumber || res.data?.document_number || 'VDS Certificate';
      setNotice(`Mushak 6.6 VDS certificate ${docNum} issued successfully.`);
      setShowMushak66Modal(false);
      await loadData();
      if (res.data?.id) {
        try {
          const fullDoc = await api<{ data: any }>(`/tax/documents/${res.data.id}`);
          if (fullDoc.data) {
            setViewDoc(normalizeDoc(fullDoc.data));
          }
        } catch {}
      }
    } catch (err: any) {
      setError(err?.message || 'Could not issue Mushak 6.6 Certificate');
    } finally {
      setBusy(false);
    }
  }

  const safeDocs = Array.isArray(documents) ? documents : [];

  const filteredDocs = safeDocs.filter((doc) => {
    if (docTypeFilter !== 'ALL' && doc.document_type !== docTypeFilter) return false;
    if (statusFilter !== 'ALL' && doc.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = doc.document_number?.toLowerCase().includes(q);
      const matchParty = doc.party_name?.toLowerCase().includes(q);
      const matchRef = doc.reference_number?.toLowerCase().includes(q);
      if (!matchNum && !matchParty && !matchRef) return false;
    }
    return true;
  });

  const docTypeLabels: Record<string, { label: string; sub: string; color: string; bg: string }> = {
    mushak_6_3: { label: 'Mushak 6.3', sub: 'Tax Invoice', color: '#2563eb', bg: '#eff6ff' },
    mushak_6_5: { label: 'Mushak 6.5', sub: 'Goods Transfer Challan', color: '#0891b2', bg: '#ecfeff' },
    mushak_6_6: { label: 'Mushak 6.6', sub: 'VDS Certificate', color: '#16a34a', bg: '#f0fdf4' },
    mushak_6_7: { label: 'Mushak 6.7', sub: 'Credit Note', color: '#d97706', bg: '#fffbeb' },
    mushak_6_8: { label: 'Mushak 6.8', sub: 'Debit Note', color: '#dc2626', bg: '#fef2f2' },
    treasury_challan: { label: 'Treasury Challan', sub: 'Government A-Challan', color: '#7c3aed', bg: '#f5f3ff' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#16a34a' }}>
              NBR Statutory Documents Register
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
              VAT Act 2012 Compliance
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Tax Document Register
          </h1>
          <p className="muted">
            Official statutory VAT certificates and challans: Mushak 6.3 (Sales Invoice), 6.5 (Transfer Challan), 6.6 (VDS Certificate), 6.7/6.8 (Credit/Debit Note), and Treasury A-Challan.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void loadData()}>
            Refresh
          </button>
          <button
            className="btn"
            style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontWeight: 600 }}
            onClick={() => setShowMushak66Modal(true)}
          >
            <Plus size={16} />
            <span>Issue Mushak 6.6 (VDS)</span>
          </button>
          <button
            className="btn btn-primary"
            style={{ fontWeight: 600 }}
            onClick={() => setShowMushak65Modal(true)}
          >
            <Truck size={16} />
            <span>Issue Mushak 6.5 (Challan)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="alert-success" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="stat-grid">
        <div className="panel stat">
          <div className="stat-label">Total Documents Issued</div>
          <div className="stat-value">{safeDocs.length}</div>
          <div className="stat-note">Statutory NBR Register</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Mushak 6.3 Invoices</div>
          <div className="stat-value" style={{ color: '#2563eb' }}>
            {safeDocs.filter((d) => d.document_type === 'mushak_6_3').length}
          </div>
          <div className="stat-note">Sales &amp; Distribution</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Mushak 6.6 VDS Certificates</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>
            {safeDocs.filter((d) => d.document_type === 'mushak_6_6').length}
          </div>
          <div className="stat-note">Supplier Withholding Tax</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Mushak 6.5 Stock Transfers</div>
          <div className="stat-value" style={{ color: '#0891b2' }}>
            {safeDocs.filter((d) => d.document_type === 'mushak_6_5').length}
          </div>
          <div className="stat-note">Depot / Fair Movements</div>
        </div>
      </div>

      {/* Filter and Document Type Tabs */}
      <div className="panel" style={{ padding: 18, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        {/* Document Type Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { key: 'ALL', label: 'All Documents' },
            { key: 'mushak_6_3', label: 'Mushak 6.3 (Sales)' },
            { key: 'mushak_6_5', label: 'Mushak 6.5 (Transfer)' },
            { key: 'mushak_6_6', label: 'Mushak 6.6 (VDS)' },
            { key: 'mushak_6_7', label: 'Mushak 6.7 (Credit Note)' },
            { key: 'mushak_6_8', label: 'Mushak 6.8 (Debit Note)' },
            { key: 'treasury_challan', label: 'Treasury Challan' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setDocTypeFilter(tab.key)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                borderColor: docTypeFilter === tab.key ? '#2563eb' : '#e2e8f0',
                background: docTypeFilter === tab.key ? '#eff6ff' : '#ffffff',
                color: docTypeFilter === tab.key ? '#1d4ed8' : '#64748b',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Status Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} />
            <input
              type="text"
              className="input"
              placeholder="Search by Document #, Party name, Reference invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 40 }}
            />
          </div>

          <div style={{ width: 170 }}>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: 40 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="submitted">Submitted</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <span style={{ fontSize: 13, color: '#64748b', marginLeft: 'auto' }}>
            {filteredDocs.length} documents found
          </span>
        </div>
      </div>

      {/* Documents Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document Details</th>
                <th>Type / NBR Form</th>
                <th>Issue Date</th>
                <th>Counterparty / Entity</th>
                <th>Taxable Base (BDT)</th>
                <th>VAT / VDS (BDT)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    Loading tax documents...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    No statutory documents found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const meta = docTypeLabels[doc.document_type] || {
                    label: doc.document_type,
                    sub: doc.document_type,
                    color: '#475569',
                    bg: '#f1f5f9',
                  };

                  return (
                    <tr key={doc.id} style={{ transition: 'background 0.1s' }}>
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: 13.5 }}>
                          {doc.document_number}
                        </strong>
                        {doc.reference_number && (
                          <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>
                            Ref: {doc.reference_number} ({doc.reference_type || 'General'})
                          </small>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            flexDirection: 'column',
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: meta.bg,
                            border: `1px solid ${meta.color}30`,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>
                            {meta.label}
                          </span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>{meta.sub}</span>
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: '#334155' }}>{doc.issue_date}</div>
                      </td>
                      <td>
                        <strong style={{ display: 'block', fontSize: 13, color: '#1e293b' }}>
                          {doc.party_name}
                        </strong>
                        <small style={{ color: '#64748b' }}>
                          {doc.party_type} · BIN/TIN: {doc.party_bin_tin || 'N/A'}
                        </small>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>
                          BDT {Number(doc.taxable_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>
                          BDT {Number(doc.tax_amount || doc.vds_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: doc.status === 'issued' ? '#dcfce7' : '#f1f5f9',
                            color: doc.status === 'issued' ? '#15803d' : '#475569',
                            border: `1px solid ${doc.status === 'issued' ? '#86efac' : '#cbd5e1'}`,
                          }}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-sm"
                          style={{ gap: 6, height: 32, padding: '0 10px', fontSize: 12 }}
                          onClick={() => setViewDoc(doc)}
                        >
                          <Printer size={14} />
                          <span>View &amp; Print</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW & PRINT NBR DOCUMENT MODAL */}
      {viewDoc && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 820,
              width: '95%',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Action Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={20} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    NBR Statutory Document: {viewDoc.document_number}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    Standard Government Form · National Board of Revenue Bangladesh
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ height: 36, padding: '0 14px', gap: 6, fontSize: 13 }}
                  onClick={() => window.print()}
                >
                  <Printer size={15} />
                  <span>Print Document</span>
                </button>
                <button
                  className="btn"
                  style={{ height: 36, width: 36, padding: 0 }}
                  onClick={() => setViewDoc(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Document Printable Sheet */}
            <div
              style={{
                padding: 36,
                maxHeight: 'calc(90vh - 120px)',
                overflowY: 'auto',
                background: '#ffffff',
                fontFamily: 'serif',
                color: '#111827',
              }}
            >
              {/* Official NBR Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 16, marginBottom: 20 }}>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600 }}>Government of the People's Republic of Bangladesh</p>
                
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700 }}>National Board of Revenue (NBR)</p>
                <h2 style={{ margin: '8px 0 4px', fontSize: 18, fontWeight: 800, textTransform: 'uppercase' }}>
                  {viewDoc.document_type === 'mushak_6_3' && 'TAX INVOICE · MUSHAK-6.3'}
                  {viewDoc.document_type === 'mushak_6_5' && 'GOODS TRANSFER CHALLAN · MUSHAK-6.5'}
                  {viewDoc.document_type === 'mushak_6_6' && 'CERTIFICATE OF VDS · MUSHAK-6.6'}
                  {viewDoc.document_type === 'mushak_6_7' && 'CREDIT NOTE · MUSHAK-6.7'}
                  {viewDoc.document_type === 'mushak_6_8' && 'DEBIT NOTE · MUSHAK-6.8'}
                  {viewDoc.document_type === 'treasury_challan' && 'GOVERNMENT TREASURY A-CHALLAN'}
                </h2>
                <p style={{ margin: 0, fontSize: 11, fontStyle: 'italic', color: '#4b5563' }}>
                  [Prescribed under the Value Added Tax and Supplementary Duty Act 2012 & VAT Rules 2016]
                </p>
              </div>

              {/* Two Column Identification Box */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 20,
                  fontSize: 12.5,
                  padding: 14,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  marginBottom: 20,
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: 13, borderBottom: '1px solid #e5e7eb', paddingBottom: 4, marginBottom: 6 }}>
                    Registered Entity Information:
                  </strong>
                  <div><strong>Legal Name:</strong> {config?.legal_name || 'Publishing House Enterprise Ltd.'}</div>
                  <div><strong>Trade Name:</strong> {config?.trade_name || 'Enterprise Publications'}</div>
                  <div><strong>BIN:</strong> {config?.bin_number || '000123456-0101'}</div>
                  <div><strong>Commissionerate:</strong> {config?.commissionerate || 'Customs, Excise & VAT Commissionerate (Dhaka South)'}</div>
                  <div><strong>Circle &amp; Zone:</strong> {config?.tax_circle} · {config?.tax_zone}</div>
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: 13, borderBottom: '1px solid #e5e7eb', paddingBottom: 4, marginBottom: 6 }}>
                    Document &amp; Recipient Information:
                  </strong>
                  <div><strong>Document No:</strong> {viewDoc.document_number}</div>
                  <div><strong>Issue Date:</strong> {viewDoc.issue_date}</div>
                  <div><strong>Recipient Name:</strong> {viewDoc.party_name}</div>
                  <div><strong>Recipient BIN/TIN:</strong> {viewDoc.party_bin_tin || 'Not Applicable (Unregistered / Retail)'}</div>
                  {viewDoc.reference_number && (
                    <div><strong>Reference No:</strong> {viewDoc.reference_number}</div>
                  )}
                </div>
              </div>

              {/* Document Details Table */}
              <div style={{ marginBottom: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, border: '1px solid #000' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ border: '1px solid #000', padding: 8, textAlign: 'center', width: 40 }}>SL</th>
                      <th style={{ border: '1px solid #000', padding: 8, textAlign: 'left' }}>Goods / Services Description</th>
                      <th style={{ border: '1px solid #000', padding: 8, textAlign: 'center', width: 100 }}>HS Code</th>
                      <th style={{ border: '1px solid #000', padding: 8, textAlign: 'right', width: 120 }}>Value (Excl. Tax)</th>
                      <th style={{ border: '1px solid #000', padding: 8, textAlign: 'right', width: 120 }}>VAT / VDS Amount</th>
                      <th style={{ border: '1px solid #000', padding: 8, textAlign: 'right', width: 130 }}>Total Amount (BDT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>1</td>
                      <td style={{ border: '1px solid #000', padding: 8 }}>
                        <strong>{viewDoc.party_name}</strong>
                        <div style={{ fontSize: 11, color: '#4b5563' }}>
                          {viewDoc.document_type === 'mushak_6_5'
                            ? `Destination: ${viewDoc.details_json?.toLocation || 'Central Depot'} · Vehicle: ${viewDoc.details_json?.vehicleNumber || 'N/A'}`
                            : viewDoc.document_type === 'mushak_6_6'
                            ? `Supplier Invoice: ${viewDoc.details_json?.supplierInvoiceNumber || 'N/A'} · Treasury Code: 1/1101/0020/0311`
                            : 'Publication, printing and wholesale distribution statutory transaction'}
                        </div>
                      </td>
                      <td style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>4901.99.00</td>
                      <td style={{ border: '1px solid #000', padding: 8, textAlign: 'right' }}>
                        BDT {Number(viewDoc.taxable_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ border: '1px solid #000', padding: 8, textAlign: 'right' }}>
                        BDT {Number(viewDoc.tax_amount || viewDoc.vds_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ border: '1px solid #000', padding: 8, textAlign: 'right', fontWeight: 700 }}>
                        BDT {(Number(viewDoc.taxable_amount || 0) + Number(viewDoc.tax_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                      <td colSpan={3} style={{ border: '1px solid #000', padding: 8, textAlign: 'right' }}>
                        Total Amount (BDT):
                      </td>
                      <td style={{ border: '1px solid #000', padding: 8, textAlign: 'right' }}>
                        BDT {Number(viewDoc.taxable_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ border: '1px solid #000', padding: 8, textAlign: 'right' }}>
                        BDT {Number(viewDoc.tax_amount || viewDoc.vds_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ border: '1px solid #000', padding: 8, textAlign: 'right' }}>
                        BDT {(Number(viewDoc.taxable_amount || 0) + Number(viewDoc.tax_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Legal Declaration & Signatures */}
              <div style={{ marginTop: 30, fontSize: 11.5, color: '#374151' }}>
                <p style={{ margin: '0 0 40px' }}>
                  It is certified that the information furnished herein is true, correct, and in accordance with the provisions of the Value Added Tax and Supplementary Duty Act, 2012.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, textAlign: 'center' }}>
                  <div>
                    <div style={{ borderTop: '1px dashed #000', paddingTop: 6, width: 220, margin: '0 auto' }}>
                      Authorized Signatory & Seal
                      <br />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>(Authorized Signatory, Enterprise Publications)</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px dashed #000', paddingTop: 6, width: 220, margin: '0 auto' }}>
                      Customs, Excise & VAT Officer / Recipient
                      <br />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>(Customs, Excise &amp; VAT Officer / Recipient)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ISSUE MUSHAK 6.5 (STOCK TRANSFER) MODAL */}
      {showMushak65Modal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 680,
              width: '95%',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Truck size={20} color="#0891b2" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    Issue Mushak 6.5 Challan (Goods Transfer)
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    Required for inter-depot and book fair inventory movements under VAT Act Sec 51
                  </p>
                </div>
              </div>
              <button
                className="btn"
                style={{ width: 34, height: 34, padding: 0 }}
                onClick={() => setShowMushak65Modal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateMushak65} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field">
                  Transfer Date <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="date"
                    className="input"
                    required
                    value={m65TransferDate}
                    onChange={(e) => setM65TransferDate(e.target.value)}
                  />
                </label>
                <label className="field">
                  Vehicle Type <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="text"
                    className="input"
                    required
                    value={m65VehicleType}
                    onChange={(e) => setM65VehicleType(e.target.value)}
                    placeholder="e.g. Covered Van / Truck"
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field">
                  From Location (Origin) <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="text"
                    className="input"
                    required
                    value={m65FromLocation}
                    onChange={(e) => setM65FromLocation(e.target.value)}
                  />
                </label>
                <label className="field">
                  To Location (Destination) <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="text"
                    className="input"
                    required
                    value={m65ToLocation}
                    onChange={(e) => setM65ToLocation(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field">
                  Vehicle Registration Number <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="text"
                    className="input"
                    required
                    value={m65VehicleNumber}
                    onChange={(e) => setM65VehicleNumber(e.target.value)}
                    placeholder="Dhaka Metro-U-11-2345"
                  />
                </label>
                <label className="field">
                  Driver Name &amp; Phone
                  <input
                    type="text"
                    className="input"
                    value={m65DriverName}
                    onChange={(e) => setM65DriverName(e.target.value)}
                    placeholder="Mohammad Rafiq (+8801711...)"
                  />
                </label>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: 13, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Consigned Titles / Goods:
                </strong>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569' }}>
                  {m65Items.map((item, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>
                      <strong>{item.bookTitle}</strong> — {item.quantity} copies (Est. BDT {item.estimatedValue.toLocaleString()})
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowMushak65Modal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                >
                  {busy ? 'Issuing...' : 'Issue Mushak 6.5 Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ISSUE MUSHAK 6.6 (VDS CERTIFICATE) MODAL */}
      {showMushak66Modal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 680,
              width: '95%',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={20} color="#16a34a" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    Issue Mushak 6.6 Certificate (Withholding Tax / VDS)
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    Statutory withholding tax certificate for press, paper and courier suppliers
                  </p>
                </div>
              </div>
              <button
                className="btn"
                style={{ width: 34, height: 34, padding: 0 }}
                onClick={() => setShowMushak66Modal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateMushak66} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label className="field">
                Supplier / Press <span style={{ color: '#ef4444' }}>*</span>
                <select
                  className="input"
                  required
                  value={m66SupplierId}
                  onChange={(e) => setM66SupplierId(e.target.value)}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_code} · {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field">
                  Supplier Invoice # <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="text"
                    className="input"
                    required
                    value={m66InvoiceNumber}
                    onChange={(e) => setM66InvoiceNumber(e.target.value)}
                    placeholder="INV-2026-0042"
                  />
                </label>
                <label className="field">
                  Invoice Date <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="date"
                    className="input"
                    required
                    value={m66InvoiceDate}
                    onChange={(e) => setM66InvoiceDate(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <label className="field">
                  Total Bill (BDT) <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    required
                    value={m66BillAmount}
                    onChange={(e) => {
                      const bill = Number(e.target.value);
                      setM66BillAmount(e.target.value);
                      setM66VatAmount((bill * 0.15).toFixed(2));
                      setM66VdsDeducted((bill * 0.08).toFixed(2)); // Standard 8% printing VDS
                    }}
                    placeholder="100000"
                  />
                </label>
                <label className="field">
                  VAT Charged (BDT)
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={m66VatAmount}
                    onChange={(e) => setM66VatAmount(e.target.value)}
                    placeholder="15000"
                  />
                </label>
                <label className="field">
                  VDS Deducted (BDT) <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    required
                    value={m66VdsDeducted}
                    onChange={(e) => setM66VdsDeducted(e.target.value)}
                    placeholder="8000"
                  />
                </label>
              </div>

              <label className="field">
                Treasury Deposit A-Challan Reference (Optional)
                <input
                  type="text"
                  className="input"
                  value={m66TreasuryChallan}
                  onChange={(e) => setM66TreasuryChallan(e.target.value)}
                  placeholder="e.g. TR-CH-2026-0311-094"
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowMushak66Modal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !m66SupplierId || !m66InvoiceNumber || !m66BillAmount || !m66VdsDeducted}
                >
                  {busy ? 'Issuing...' : 'Issue Mushak 6.6 Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
