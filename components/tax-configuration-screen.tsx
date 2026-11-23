"use client";

import { useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  Save,
  RefreshCw,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  HelpCircle,
  Plus,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';

type TaxConfig = {
  organization_id: string;
  bin_number: string;
  legal_name: string;
  trade_name: string;
  tax_circle: string;
  tax_zone: string;
  commissionerate: string;
  division: string;
  regime: string;
  treasury_code_vat: string;
  treasury_code_vds: string;
  treasury_code_tds: string;
  input_vat_account_id: string | null;
  output_vat_account_id: string | null;
  vds_payable_account_id: string | null;
  tds_payable_account_id: string | null;
  vat_current_account_id: string | null;
  updated_at: string;
};

type GLAccount = {
  id: string;
  account_code: string;
  name: string;
  type: string;
  classification: string;
};

const DEFAULT_COMMISSIONERATES = [
  'Customs, Excise & VAT Commissionerate (Dhaka South)',
  'Customs, Excise & VAT Commissionerate (Dhaka North)',
  'Customs, Excise & VAT Commissionerate (Dhaka East)',
  'Customs, Excise & VAT Commissionerate (Dhaka West)',
  'Customs, Excise & VAT Commissionerate (Chattogram)',
  'Customs, Excise & VAT Commissionerate (Rajshahi)',
  'Customs, Excise & VAT Commissionerate (Khulna)',
  'Customs, Excise & VAT Commissionerate (Sylhet)',
  'Customs, Excise & VAT Commissionerate (Rangpur)',
  'Large Taxpayers Unit (LTU-VAT)',
];

const DEFAULT_DIVISIONS = [
  'Motijheel Division',
  'Dhanmondi Division',
  'Gulshan Division',
  'Tejgaon Division',
  'Mirpur Division',
  'Uttara Division',
  'Kotwali Division',
  'Sadarghat Division, Dhaka',
  'Agrabad Division, Chattogram',
  'Narayanganj Division',
];

const DEFAULT_CIRCLES = [
  'Circle-15 (Publications & Press)',
  'Circle-10 (Commercial Print)',
  'Circle-8 (Retail Trade)',
  'Circle-12 (Corporate)',
  'Circle-24 (Printing & Packaging)',
  'Circle-3 (Wholesale & Books)',
  'Circle-1 (Large Press & Publishers)',
];

const DEFAULT_ZONES = [
  'Taxes Zone-02, Dhaka',
  'Taxes Zone-01, Dhaka',
  'Taxes Zone-04, Dhaka',
  'Taxes Zone-05, Dhaka',
  'Taxes Zone-08, Dhaka',
  'Taxes Zone-01, Chattogram',
  'Taxes Zone-02, Chattogram',
  'Large Taxpayers Unit (LTU-Income Tax)',
];

const DEFAULT_TREASURY_VAT = [
  '1/1101/0020/0311',
  '1/1101/0020/0301',
  '1/1101/0025/0311',
];

const DEFAULT_TREASURY_VDS = [
  '1/1101/0020/0311',
  '1/1101/0025/0311',
];

const DEFAULT_TREASURY_TDS = [
  '1/1141/0010/0111',
  '1/1141/0010/0115',
  '1/1141/0010/0101',
];

export function TaxConfigurationScreen() {
  const [config, setConfig] = useState<TaxConfig | null>(null);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Dropdown Options State (allows user to add new ones with + button)
  const [commissionerateOptions, setCommissionerateOptions] = useState<string[]>(DEFAULT_COMMISSIONERATES);
  const [divisionOptions, setDivisionOptions] = useState<string[]>(DEFAULT_DIVISIONS);
  const [taxCircleOptions, setTaxCircleOptions] = useState<string[]>(DEFAULT_CIRCLES);
  const [taxZoneOptions, setTaxZoneOptions] = useState<string[]>(DEFAULT_ZONES);
  const [vatTreasuryCodeOptions, setVatTreasuryCodeOptions] = useState<string[]>(DEFAULT_TREASURY_VAT);
  const [vdsTreasuryCodeOptions, setVdsTreasuryCodeOptions] = useState<string[]>(DEFAULT_TREASURY_VDS);
  const [tdsTreasuryCodeOptions, setTdsTreasuryCodeOptions] = useState<string[]>(DEFAULT_TREASURY_TDS);

  // Form State
  const [binNumber, setBinNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [taxCircle, setTaxCircle] = useState('');
  const [taxZone, setTaxZone] = useState('');
  const [commissionerate, setCommissionerate] = useState('');
  const [division, setDivision] = useState('');
  const [regime, setRegime] = useState('standard');
  const [treasuryCodeVat, setTreasuryCodeVat] = useState('');
  const [treasuryCodeVds, setTreasuryCodeVds] = useState('');
  const [treasuryCodeTds, setTreasuryCodeTds] = useState('');
  const [inputVatAccountId, setInputVatAccountId] = useState('');
  const [outputVatAccountId, setOutputVatAccountId] = useState('');
  const [vdsPayableAccountId, setVdsPayableAccountId] = useState('');
  const [tdsPayableAccountId, setTdsPayableAccountId] = useState('');
  const [vatCurrentAccountId, setVatCurrentAccountId] = useState('');

  // Modal State for adding new options
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    placeholder: string;
    targetField: string;
  }>({
    isOpen: false,
    title: '',
    description: '',
    placeholder: '',
    targetField: '',
  });
  const [customInputValue, setCustomInputValue] = useState('');

  function openAddModal(targetField: string, title: string, placeholder: string, description: string) {
    setModalState({
      isOpen: true,
      title,
      description,
      placeholder,
      targetField,
    });
    setCustomInputValue('');
  }

  function handleAddOption() {
    const val = customInputValue.trim();
    if (!val) return;

    switch (modalState.targetField) {
      case 'commissionerate':
        if (!commissionerateOptions.includes(val)) {
          setCommissionerateOptions(prev => [...prev, val]);
        }
        setCommissionerate(val);
        break;
      case 'division':
        if (!divisionOptions.includes(val)) {
          setDivisionOptions(prev => [...prev, val]);
        }
        setDivision(val);
        break;
      case 'taxCircle':
        if (!taxCircleOptions.includes(val)) {
          setTaxCircleOptions(prev => [...prev, val]);
        }
        setTaxCircle(val);
        break;
      case 'taxZone':
        if (!taxZoneOptions.includes(val)) {
          setTaxZoneOptions(prev => [...prev, val]);
        }
        setTaxZone(val);
        break;
      case 'treasuryCodeVat':
        if (!vatTreasuryCodeOptions.includes(val)) {
          setVatTreasuryCodeOptions(prev => [...prev, val]);
        }
        setTreasuryCodeVat(val);
        break;
      case 'treasuryCodeVds':
        if (!vdsTreasuryCodeOptions.includes(val)) {
          setVdsTreasuryCodeOptions(prev => [...prev, val]);
        }
        setTreasuryCodeVds(val);
        break;
      case 'treasuryCodeTds':
        if (!tdsTreasuryCodeOptions.includes(val)) {
          setTdsTreasuryCodeOptions(prev => [...prev, val]);
        }
        setTreasuryCodeTds(val);
        break;
    }

    setModalState(prev => ({ ...prev, isOpen: false }));
    setCustomInputValue('');
  }

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [configRes, accountsRes] = await Promise.all([
        api<{ data: TaxConfig }>('/tax/configuration'),
        api<{ data: GLAccount[] }>('/tax/gl-accounts'),
      ]);

      const c = configRes.data;
      setConfig(c);
      setGlAccounts(accountsRes.data || []);

      setBinNumber(c.bin_number || '');
      setLegalName(c.legal_name || '');
      setTradeName(c.trade_name || '');

      const comm = c.commissionerate || 'Customs, Excise & VAT Commissionerate (Dhaka South)';
      setCommissionerate(comm);
      if (!DEFAULT_COMMISSIONERATES.includes(comm)) {
        setCommissionerateOptions(prev => prev.includes(comm) ? prev : [...prev, comm]);
      }

      const div = c.division || 'Motijheel Division';
      setDivision(div);
      if (!DEFAULT_DIVISIONS.includes(div)) {
        setDivisionOptions(prev => prev.includes(div) ? prev : [...prev, div]);
      }

      const circ = c.tax_circle || 'Circle-15 (Publications & Press)';
      setTaxCircle(circ);
      if (!DEFAULT_CIRCLES.includes(circ)) {
        setTaxCircleOptions(prev => prev.includes(circ) ? prev : [...prev, circ]);
      }

      const zone = c.tax_zone || 'Taxes Zone-02, Dhaka';
      setTaxZone(zone);
      if (!DEFAULT_ZONES.includes(zone)) {
        setTaxZoneOptions(prev => prev.includes(zone) ? prev : [...prev, zone]);
      }

      setRegime(c.regime || 'standard');

      const vatCode = c.treasury_code_vat || '1/1101/0020/0311';
      setTreasuryCodeVat(vatCode);
      if (!DEFAULT_TREASURY_VAT.includes(vatCode)) {
        setVatTreasuryCodeOptions(prev => prev.includes(vatCode) ? prev : [...prev, vatCode]);
      }

      const vdsCode = c.treasury_code_vds || '1/1101/0020/0311';
      setTreasuryCodeVds(vdsCode);
      if (!DEFAULT_TREASURY_VDS.includes(vdsCode)) {
        setVdsTreasuryCodeOptions(prev => prev.includes(vdsCode) ? prev : [...prev, vdsCode]);
      }

      const tdsCode = c.treasury_code_tds || '1/1141/0010/0111';
      setTreasuryCodeTds(tdsCode);
      if (!DEFAULT_TREASURY_TDS.includes(tdsCode)) {
        setTdsTreasuryCodeOptions(prev => prev.includes(tdsCode) ? prev : [...prev, tdsCode]);
      }

      setInputVatAccountId(c.input_vat_account_id || '');
      setOutputVatAccountId(c.output_vat_account_id || '');
      setVdsPayableAccountId(c.vds_payable_account_id || '');
      setTdsPayableAccountId(c.tds_payable_account_id || '');
      setVatCurrentAccountId(c.vat_current_account_id || '');
    } catch (err: any) {
      setError(err?.message || 'Could not load tax configuration');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: TaxConfig }>('/tax/configuration', {
        method: 'PUT',
        body: JSON.stringify({
          binNumber,
          legalName,
          tradeName,
          taxCircle,
          taxZone,
          commissionerate,
          division,
          regime,
          treasuryCodeVat,
          treasuryCodeVds,
          treasuryCodeTds,
          inputVatAccountId: inputVatAccountId || null,
          outputVatAccountId: outputVatAccountId || null,
          vdsPayableAccountId: vdsPayableAccountId || null,
          tdsPayableAccountId: tdsPayableAccountId || null,
          vatCurrentAccountId: vatCurrentAccountId || null,
        }),
      });
      setConfig(res.data);
      setNotice('Tax configuration and GL mappings successfully saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update tax configuration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Tax Configuration &amp; NBR Profile</h1>
          <p className="muted">
            Manage your organization&apos;s 13-digit BIN, NBR VAT Commissionerate, Treasury A-Challan codes, and General Ledger accounts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="alert-success" role="status" style={{ marginBottom: 16 }}>{notice}</div>}

      {/* KPI Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className="panel stat" style={{ borderLeft: '4px solid #2563eb', padding: '16px 20px', background: '#fff', borderRadius: 10 }}>
          <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Active 13-Digit BIN</span>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 2px', letterSpacing: '0.04em' }}>
            {config?.bin_number || binNumber || '001928374-0101'}
          </div>
          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✓ Verified NBR Registered</span>
        </div>

        <div className="panel stat" style={{ borderLeft: '4px solid #10b981', padding: '16px 20px', background: '#fff', borderRadius: 10 }}>
          <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Tax Regime</span>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 2px', textTransform: 'capitalize' }}>
            {regime}
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>Publication Exemption + VDS Withholding</span>
        </div>

        <div className="panel stat" style={{ borderLeft: '4px solid #8b5cf6', padding: '16px 20px', background: '#fff', borderRadius: 10 }}>
          <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>VAT Commissionerate</span>
          <div className="stat-value" style={{ fontSize: 15, fontWeight: 700, margin: '6px 0 2px', color: '#1e293b' }}>
            {commissionerate.includes('Dhaka South') ? 'Dhaka South' : commissionerate || 'Dhaka South'}
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>{division} · {taxCircle}</span>
        </div>

        <div className="panel stat" style={{ borderLeft: '4px solid #f59e0b', padding: '16px 20px', background: '#fff', borderRadius: 10 }}>
          <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Treasury Deposit Code</span>
          <div className="stat-value" style={{ fontSize: 16, fontWeight: 700, margin: '6px 0 2px', color: '#1e293b' }}>
            {treasuryCodeVat || '1/1101/0020/0311'}
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>Bangladesh Bank / Sonali A-Challan</span>
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSave}>
        {/* Section 1: Statutory NBR Identity */}
        <div className="panel" style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
            <Building2 size={20} color="#2563eb" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              1. Statutory Business Identification (NBR Registration)
            </h3>
          </div>

          <div className="catalog-form-grid" style={{ gap: 16 }}>
            <label className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                13-Digit Business Identification Number (BIN) <span style={{ color: '#ef4444' }}>*</span>
              </span>
              <input
                className="input"
                required
                placeholder="e.g. 001928374-0101"
                value={binNumber}
                onChange={e => setBinNumber(e.target.value)}
                style={{ height: 42, borderRadius: 8 }}
              />
            </label>

            <label className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Legal Registered Company Name <span style={{ color: '#ef4444' }}>*</span>
              </span>
              <input
                className="input"
                required
                placeholder="e.g. Publishing House Enterprise Ltd."
                value={legalName}
                onChange={e => setLegalName(e.target.value)}
                style={{ height: 42, borderRadius: 8 }}
              />
            </label>

            <label className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Trade / Publication Brand Name</span>
              <input
                className="input"
                placeholder="e.g. Enterprise Publications Bangladesh"
                value={tradeName}
                onChange={e => setTradeName(e.target.value)}
                style={{ height: 42, borderRadius: 8 }}
              />
            </label>

            <label className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Tax Regime</span>
              <select
                className="input"
                value={regime}
                onChange={e => setRegime(e.target.value)}
                style={{ height: 42, borderRadius: 8 }}
              >
                <option value="standard">Standard Rate (15% with exemptions on books)</option>
                <option value="reduced">Reduced Rate Publication</option>
                <option value="turnover">Turnover Tax Regime (4%)</option>
                <option value="cottage">Cottage Industry (Fully Exempt)</option>
              </select>
            </label>

            {/* Commissionerate with Dropdown + Add (+) Button */}
            <label className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Customs, Excise &amp; VAT Commissionerate</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>Select or add new</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  className="input"
                  value={commissionerate}
                  onChange={e => setCommissionerate(e.target.value)}
                  style={{ height: 42, borderRadius: 8, flex: 1 }}
                >
                  {commissionerateOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openAddModal(
                    'commissionerate',
                    'Add VAT Commissionerate',
                    'e.g. Customs, Excise & VAT Commissionerate (Mymensingh)',
                    'Enter a new Customs, Excise and VAT Commissionerate jurisdiction.'
                  )}
                  className="btn"
                  title="Add Custom Commissionerate"
                  style={{
                    height: 42,
                    width: 42,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#2563eb',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </label>

            {/* VAT Division with Dropdown + Add (+) Button */}
            <label className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>VAT Division</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>Select or add new</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  className="input"
                  value={division}
                  onChange={e => setDivision(e.target.value)}
                  style={{ height: 42, borderRadius: 8, flex: 1 }}
                >
                  {divisionOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openAddModal(
                    'division',
                    'Add VAT Division',
                    'e.g. Dhanmondi Division',
                    'Enter a new administrative VAT division.'
                  )}
                  className="btn"
                  title="Add Custom Division"
                  style={{
                    height: 42,
                    width: 42,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#2563eb',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </label>

            {/* Tax Circle with Dropdown + Add (+) Button */}
            <label className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Tax Circle</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>Select or add new</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  className="input"
                  value={taxCircle}
                  onChange={e => setTaxCircle(e.target.value)}
                  style={{ height: 42, borderRadius: 8, flex: 1 }}
                >
                  {taxCircleOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openAddModal(
                    'taxCircle',
                    'Add Tax Circle',
                    'e.g. Circle-18 (Printing & Paper)',
                    'Enter a new NBR assessment circle.'
                  )}
                  className="btn"
                  title="Add Custom Tax Circle"
                  style={{
                    height: 42,
                    width: 42,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#2563eb',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </label>

            {/* Income Tax Zone with Dropdown + Add (+) Button */}
            <label className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Income Tax Zone</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>Select or add new</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  className="input"
                  value={taxZone}
                  onChange={e => setTaxZone(e.target.value)}
                  style={{ height: 42, borderRadius: 8, flex: 1 }}
                >
                  {taxZoneOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openAddModal(
                    'taxZone',
                    'Add Income Tax Zone',
                    'e.g. Taxes Zone-03, Dhaka',
                    'Enter a new Income Tax Commission Zone.'
                  )}
                  className="btn"
                  title="Add Custom Tax Zone"
                  style={{
                    height: 42,
                    width: 42,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#2563eb',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </label>
          </div>
        </div>

        {/* Section 2: Treasury Deposit Codes */}
        <div className="panel" style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
            <Landmark size={20} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              2. Bangladesh Bank &amp; Sonali Bank A-Challan Economic Codes
            </h3>
          </div>

          <div className="catalog-form-grid" style={{ gap: 16 }}>
            {/* VAT Treasury Code with Dropdown + Add (+) Button */}
            <label className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>VAT Treasury Code</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>Standard: 1/1101/0020/0311</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  className="input"
                  value={treasuryCodeVat}
                  onChange={e => setTreasuryCodeVat(e.target.value)}
                  style={{ height: 42, borderRadius: 8, flex: 1 }}
                >
                  {vatTreasuryCodeOptions.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openAddModal(
                    'treasuryCodeVat',
                    'Add VAT Treasury Deposit Code',
                    'e.g. 1/1101/0020/0311',
                    'Enter a valid 13-digit Treasury Economic Account Code for VAT deposit.'
                  )}
                  className="btn"
                  title="Add Custom VAT Treasury Code"
                  style={{
                    height: 42,
                    width: 42,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#2563eb',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Used on Mushak 9.1 Part 8 treasury deposit challans</span>
            </label>

            {/* VDS Treasury Code with Dropdown + Add (+) Button */}
            <label className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>VDS Treasury Code</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>Withholding on suppliers</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  className="input"
                  value={treasuryCodeVds}
                  onChange={e => setTreasuryCodeVds(e.target.value)}
                  style={{ height: 42, borderRadius: 8, flex: 1 }}
                >
                  {vdsTreasuryCodeOptions.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openAddModal(
                    'treasuryCodeVds',
                    'Add VDS Treasury Code',
                    'e.g. 1/1101/0020/0311',
                    'Enter a valid Treasury Economic Account Code for VDS supplier withholding.'
                  )}
                  className="btn"
                  title="Add Custom VDS Treasury Code"
                  style={{
                    height: 42,
                    width: 42,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#2563eb',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Deposited before 15th of month for printing presses</span>
            </label>

            {/* TDS Treasury Code with Dropdown + Add (+) Button */}
            <label className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>TDS Treasury Code</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>Authors &amp; Suppliers</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  className="input"
                  value={treasuryCodeTds}
                  onChange={e => setTreasuryCodeTds(e.target.value)}
                  style={{ height: 42, borderRadius: 8, flex: 1 }}
                >
                  {tdsTreasuryCodeOptions.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openAddModal(
                    'treasuryCodeTds',
                    'Add TDS Treasury Code',
                    'e.g. 1/1141/0010/0115',
                    'Enter a Treasury Economic Account Code for Author Royalty / Supplier TDS.'
                  )}
                  className="btn"
                  title="Add Custom TDS Treasury Code"
                  style={{
                    height: 42,
                    width: 42,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#2563eb',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Standard code: 1/1141/0010/0111 (Suppliers) · 1/1141/0010/0115 (Royalties)</span>
            </label>
          </div>
        </div>

        {/* Section 3: General Ledger Integration Mapping */}
        <div className="panel" style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
            <FileText size={20} color="#8b5cf6" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              3. Finance Chart of Accounts (GL) Mapping
            </h3>
          </div>

          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
            Map automatic journal accounts for Sales Invoices, Supplier Withholding (VDS), and Treasury Payments:
          </p>

          <div className="catalog-form-grid" style={{ gap: 16 }}>
            <label className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Output VAT Account (Liability)</span>
              <select
                className="input"
                value={outputVatAccountId}
                onChange={e => setOutputVatAccountId(e.target.value)}
                style={{ height: 42, borderRadius: 8 }}
              >
                <option value="">Select Account (e.g. 2100 Output VAT Payable)</option>
                {glAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} · {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Input VAT Account (Asset / Rebate)</span>
              <select
                className="input"
                value={inputVatAccountId}
                onChange={e => setInputVatAccountId(e.target.value)}
                style={{ height: 42, borderRadius: 8 }}
              >
                <option value="">Select Account (e.g. 1350 Input VAT Receivable)</option>
                {glAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} · {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>VDS Withholding Payable (Liability)</span>
              <select
                className="input"
                value={vdsPayableAccountId}
                onChange={e => setVdsPayableAccountId(e.target.value)}
                style={{ height: 42, borderRadius: 8 }}
              >
                <option value="">Select Account (e.g. 2110 VDS Payable)</option>
                {glAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} · {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>TDS Withholding Payable (Liability)</span>
              <select
                className="input"
                value={tdsPayableAccountId}
                onChange={e => setTdsPayableAccountId(e.target.value)}
                style={{ height: 42, borderRadius: 8 }}
              >
                <option value="">Select Account (e.g. 2120 TDS Payable)</option>
                {glAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} · {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>VAT Current Account (Mushak 18.1)</span>
              <select
                className="input"
                value={vatCurrentAccountId}
                onChange={e => setVatCurrentAccountId(e.target.value)}
                style={{ height: 42, borderRadius: 8 }}
              >
                <option value="">Select Account (e.g. 1300 VAT Current Account)</option>
                {glAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} · {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Save Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !binNumber || !legalName}
            style={{ height: 44, padding: '0 28px', borderRadius: 9, gap: 8, fontSize: 14 }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving Changes…' : 'Save Tax Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Elegant Add Custom Option Modal */}
      {modalState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {modalState.title}
              </h3>
              <button
                type="button"
                onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.4 }}>
              {modalState.description}
            </p>

            <div style={{ marginBottom: 20 }}>
              <input
                className="input"
                autoFocus
                placeholder={modalState.placeholder}
                value={customInputValue}
                onChange={e => setCustomInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOption();
                  } else if (e.key === 'Escape') {
                    setModalState(prev => ({ ...prev, isOpen: false }));
                  }
                }}
                style={{ height: 44, borderRadius: 8, width: '100%', fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                style={{ height: 38, borderRadius: 8, padding: '0 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddOption}
                disabled={!customInputValue.trim()}
                style={{ height: 38, borderRadius: 8, padding: '0 20px', gap: 6 }}
              >
                <Plus size={15} />
                <span>Add &amp; Select</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
