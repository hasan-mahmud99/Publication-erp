'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Scale,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  TrendingDown,
  TrendingUp,
  HelpCircle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

type ReconciliationData = {
  period: string;
  totalOutputVat: number;
  totalInputVatIncurred: number;
  proportionalRebateRatio: number;
  admissibleInputVatRebate: number;
  increasingAdjustments: number;
  decreasingAdjustments: number;
  netVatPayable: number;
  glAccount2100Balance: number;
  varianceAmount: number;
  status: 'reconciled' | 'variance_detected';
  transactionsSummary: {
    salesOutputVat: number;
    rawMaterialInputVat: number;
    vdsWithheldFromSuppliers: number;
    tdsWithheldFromAuthors: number;
  };
};

export function TaxReconciliationScreen() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(currentMonth);
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadReconciliation() {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ data: ReconciliationData }>(`/tax/reconciliation?period=${period}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || 'Could not load tax reconciliation data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReconciliation();
  }, [period]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#2563eb' }}>
              VAT Act 2012 Sec 46 · Input Tax Apportionment & Rebate
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
              Proportional Rebate Engine
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Input/Output Tax Reconciliation
          </h1>
          <p className="muted">
            Monthly proportional input tax rebate under Section 46 (VAT Act 2012) for book publishing, net VAT payable, and General Ledger Account 2100 variance audit.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Tax Period:</span>
            <input
              type="month"
              className="input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ width: 160, height: 40 }}
            />
          </div>
          <button className="btn" onClick={() => void loadReconciliation()}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="alert-success" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="panel stat">
          <div className="stat-label">Total Output VAT</div>
          <div className="stat-value" style={{ color: '#2563eb' }}>
            BDT {Number(data?.totalOutputVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-note">Book Sales (Exempt 0%) + Commercial</div>
        </div>

        <div className="panel stat">
          <div className="stat-label">Input Tax Incurred</div>
          <div className="stat-value" style={{ color: '#64748b' }}>
            BDT {Number(data?.totalInputVatIncurred || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-note">Paper, ink, press bills</div>
        </div>

        <div className="panel stat">
          <div className="stat-label">Admissible Rebate</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>
            BDT {Number(data?.admissibleInputVatRebate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-note">
            Ratio: {((data?.proportionalRebateRatio || 0) * 100).toFixed(1)}% (Sec 46 Proportional)
          </div>
        </div>

        <div className="panel stat">
          <div className="stat-label">Net VAT Payable</div>
          <div className="stat-value" style={{ color: Number(data?.netVatPayable || 0) > 0 ? '#dc2626' : '#16a34a' }}>
            BDT {Number(data?.netVatPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-note">Treasury deposit before 15th</div>
        </div>
      </div>

      {/* NBR Publishing Rebate Explanation Box */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '16px 20px',
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
        }}
      >
        <BookOpen size={24} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            Publishing Regulatory Note: Section 46 Proportional Rebate
          </h3>
          <p style={{ margin: 0, fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>
            Under the First Schedule of the VAT &amp; SD Act 2012, general printed books are VAT-exempt (0% Output VAT). Under Section 46, input tax rebate cannot be directly claimed on raw materials used for exempt supplies. Therefore, input tax is apportioned based on taxable commercial turnover vs. total turnover. The non-rebateable portion of input VAT is treated as cost of goods sold.
          </p>
        </div>
      </div>

      {/* Reconciliation Engine Matrix */}
      <div className="panel" style={{ padding: 24, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Reconciliation Statement for Tax Period: {period}
          </h2>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: data?.varianceAmount === 0 ? '#dcfce7' : '#fef3c7',
              color: data?.varianceAmount === 0 ? '#15803d' : '#b45309',
              border: `1px solid ${data?.varianceAmount === 0 ? '#86efac' : '#fde68a'}`,
            }}
          >
            {data?.varianceAmount === 0 ? '✓ Balanced & Reconciled' : '⚠️ Minor Variance / Pending Posting'}
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 0', color: '#334155', fontWeight: 600 }}>
                1. Gross Output Tax on Sales (Mushak 6.3)
              </td>
              <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                + BDT {Number(data?.totalOutputVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 0', color: '#334155' }}>
                2. Total Input Tax Incurred on Procurements &amp; Raw Materials
              </td>
              <td style={{ padding: '12px 0', textAlign: 'right', color: '#64748b' }}>
                BDT {Number(data?.totalInputVatIncurred || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <td style={{ padding: '12px 12px', color: '#16a34a', fontWeight: 600 }}>
                ↳ Less: Admissible Input Tax Rebate (Section 46 Apportioned)
              </td>
              <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                - BDT {Number(data?.admissibleInputVatRebate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 0', color: '#334155' }}>
                3. Add: Increasing Adjustments (Debit Notes Mushak 6.8 &amp; VDS by Withholding Entity)
              </td>
              <td style={{ padding: '12px 0', textAlign: 'right', color: '#0f172a' }}>
                + BDT {Number(data?.increasingAdjustments || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 0', color: '#334155' }}>
                4. Less: Decreasing Adjustments (Credit Notes Mushak 6.7 &amp; Advance Tax paid at Import)
              </td>
              <td style={{ padding: '12px 0', textAlign: 'right', color: '#d97706' }}>
                - BDT {Number(data?.decreasingAdjustments || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            <tr style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
              <td style={{ padding: '14px 12px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                Net VAT Payable to Bangladesh Treasury (Mushak 9.1 Return Box 64)
              </td>
              <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: 16, fontWeight: 800, color: '#2563eb' }}>
                BDT {Number(data?.netVatPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            <tr>
              <td style={{ padding: '12px 0', color: '#64748b' }}>
                GL Account 2100 (VAT Current Account / Payable) General Ledger Balance
              </td>
              <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                BDT {Number(data?.glAccount2100Balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            <tr style={{ borderTop: '1px dashed #cbd5e1' }}>
              <td style={{ padding: '12px 0', color: data?.varianceAmount === 0 ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                GL Variance (Reconciliation Discrepancy)
              </td>
              <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: data?.varianceAmount === 0 ? '#16a34a' : '#d97706' }}>
                BDT {Number(data?.varianceAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
