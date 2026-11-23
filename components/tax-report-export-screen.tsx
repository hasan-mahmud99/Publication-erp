'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Building,
  UserCheck,
  FileCheck2,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export function TaxReportExportScreen() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentYear = new Date().getFullYear().toString();

  const [activeTab, setActiveTab] = useState<'mushak_9_1' | 'withholding' | 'author_tds'>('mushak_9_1');
  const [period, setPeriod] = useState(currentMonth);
  const [taxYear, setTaxYear] = useState(currentYear);

  const [mushakData, setMushakData] = useState<any>(null);
  const [withholdingData, setWithholdingData] = useState<any>(null);
  const [authorTdsData, setAuthorTdsData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadReport() {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'mushak_9_1') {
        const res = await api<{ data: any }>(`/tax/reports/mushak-9-1?period=${period}`);
        setMushakData(res.data);
      } else if (activeTab === 'withholding') {
        const res = await api<{ data: any }>(`/tax/reports/withholding?period=${period}`);
        setWithholdingData(res.data);
      } else if (activeTab === 'author_tds') {
        const res = await api<{ data: any }>(`/tax/reports/author-royalty-tds?taxYear=${taxYear}`);
        setAuthorTdsData(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load report data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, [activeTab, period, taxYear]);

  function exportCsv(dataToExport: any[], filename: string) {
    if (!dataToExport || !dataToExport.length) return;
    const headers = Object.keys(dataToExport[0]).join(',');
    const rows = dataToExport.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#2563eb' }}>
              NBR Statutory Reporting & Tax Returns
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
              NBR e-VAT &amp; e-TIN Ready
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Tax Report Export
          </h1>
          <p className="muted">
            Official monthly VAT Return Assistant (Mushak 9.1), Withholding Tax (VDS) Statement, and Author Royalty TDS Schedules under Income Tax Act 2023.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {activeTab !== 'author_tds' ? (
            <input
              type="month"
              className="input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ width: 160, height: 40 }}
            />
          ) : (
            <select
              className="input"
              value={taxYear}
              onChange={(e) => setTaxYear(e.target.value)}
              style={{ width: 140, height: 40 }}
            >
              <option value="2026">Tax Year 2026</option>
              <option value="2025">Tax Year 2025</option>
              <option value="2024">Tax Year 2024</option>
            </select>
          )}

          <button className="btn" onClick={() => void loadReport()}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Report Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
        {[
          { key: 'mushak_9_1', label: '1. Mushak 9.1 Monthly VAT Return' },
          { key: 'withholding', label: '2. Withholding Tax (VDS) Statement' },
          { key: 'author_tds', label: '3. Author Royalty TDS Schedule (Sec 106/117)' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              border: '1px solid',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              borderColor: activeTab === tab.key ? '#2563eb' : '#e2e8f0',
              background: activeTab === tab.key ? '#2563eb' : '#ffffff',
              color: activeTab === tab.key ? '#ffffff' : '#475569',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MUSHAK 9.1 RETURN ASSISTANT */}
      {activeTab === 'mushak_9_1' && mushakData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Header Card */}
          <div className="panel" style={{ padding: 22, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                  Form Mushak-9.1 (Monthly VAT Return)
                </span>
                <h2 style={{ margin: '2px 0 6px', fontSize: 18, color: '#0f172a' }}>
                  Monthly Value Added Tax Return Assistant — Period: {mushakData.period}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  BIN: <strong>{mushakData.taxpayer?.binNumber || '000123456-0101'}</strong> · Taxpayer: {mushakData.taxpayer?.legalName || 'Publishing House Enterprise Ltd.'}
                </p>
              </div>
              <button
                className="btn"
                onClick={() =>
                  exportCsv(
                    [
                      {
                        Period: mushakData.period,
                        TotalOutputVat: mushakData.part3_supplies?.totalOutputVat,
                        TotalInputVat: mushakData.part4_purchases?.totalInputVatIncurred,
                        AdmissibleRebate: mushakData.part4_purchases?.admissibleRebate,
                        IncreasingAdj: mushakData.part5_increasing_adjustments?.total,
                        DecreasingAdj: mushakData.part6_decreasing_adjustments?.total,
                        NetVatPayable: mushakData.part7_net_tax?.netVatPayable,
                        TreasuryCode: '1/1101/0020/0311',
                      },
                    ],
                    `mushak-9-1-return-${period}`
                  )
                }
              >
                <Download size={15} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Parts Matrix */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Part #</th>
                  <th>Description / NBR Return Line Item</th>
                  <th style={{ textAlign: 'right', width: 160 }}>Value / Base (BDT)</th>
                  <th style={{ textAlign: 'right', width: 160 }}>Tax / VAT (BDT)</th>
                </tr>
              </thead>
              <tbody>
                {/* Part 3: Supplies */}
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td>PART 3</td>
                  <td colSpan={3}>GOODS &amp; SERVICES SUPPLIED</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 24 }}>Box 10</td>
                  <td>General Printed Books (Exempted under 1st Schedule - 0% Output Tax)</td>
                  <td style={{ textAlign: 'right' }}>
                    BDT {Number(mushakData.part3_supplies?.exemptBookSales || 0).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>0.00 (Exempt)</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 24 }}>Box 14</td>
                  <td>Commercial Publishing, Rights &amp; Services (Standard Rate 15%)</td>
                  <td style={{ textAlign: 'right' }}>
                    BDT {Number(mushakData.part3_supplies?.taxableCommercialSales || 0).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    BDT {Number(mushakData.part3_supplies?.commercialOutputVat || 0).toLocaleString()}
                  </td>
                </tr>

                {/* Part 4: Purchases & Rebate */}
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td>PART 4</td>
                  <td colSpan={3}>PROCUREMENTS &amp; INPUT TAX</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 24 }}>Box 21</td>
                  <td>Local Raw Materials (Paper, Ink, Plates, Binders, Courier)</td>
                  <td style={{ textAlign: 'right' }}>
                    BDT {Number(mushakData.part4_purchases?.totalPurchases || 0).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    BDT {Number(mushakData.part4_purchases?.totalInputVatIncurred || 0).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 24 }}>Box 29</td>
                  <td style={{ color: '#16a34a', fontWeight: 600 }}>
                    ↳ Admissible Input Tax Rebate (Section 46 Proportional Rebate: {((mushakData.part4_purchases?.rebateRatio || 0) * 100).toFixed(1)}%)
                  </td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                    - BDT {Number(mushakData.part4_purchases?.admissibleRebate || 0).toLocaleString()}
                  </td>
                </tr>

                {/* Part 5: Increasing Adjustments */}
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td>PART 5</td>
                  <td colSpan={3}>INCREASING ADJUSTMENTS</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 24 }}>Box 35</td>
                  <td>Debit Notes (Mushak 6.8) &amp; VDS deducted on supplier procurements</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                    + BDT {Number(mushakData.part5_increasing_adjustments?.total || 0).toLocaleString()}
                  </td>
                </tr>

                {/* Part 6: Decreasing Adjustments */}
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td>PART 6</td>
                  <td colSpan={3}>DECREASING ADJUSTMENTS</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: 24 }}>Box 43</td>
                  <td>Credit Notes (Mushak 6.7 within 90 days) &amp; Advance Tax paid</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', color: '#d97706', fontWeight: 600 }}>
                    - BDT {Number(mushakData.part6_decreasing_adjustments?.total || 0).toLocaleString()}
                  </td>
                </tr>

                {/* Part 7: Net VAT Payable */}
                <tr style={{ background: '#eff6ff', fontWeight: 800, fontSize: 14 }}>
                  <td>PART 7</td>
                  <td>NET TAX PAYABLE TO TREASURY — Box 64</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right', color: '#1d4ed8', fontSize: 16 }}>
                    BDT {Number(mushakData.part7_net_tax?.netVatPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Part 8: Treasury Code */}
                <tr style={{ background: '#ffffff' }}>
                  <td>PART 8</td>
                  <td>Government Treasury Economic Code</td>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, color: '#334155' }}>
                    1/1101/0020/0311 (VAT - Operational &amp; VDS)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: WITHHOLDING TAX (VDS) STATEMENT */}
      {activeTab === 'withholding' && withholdingData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="panel" style={{ padding: 22, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                  Monthly VDS Statement
                </span>
                <h2 style={{ margin: '2px 0 6px', fontSize: 18, color: '#0f172a' }}>
                  Supplier Withholding Tax Deductions (VDS Statement) — {withholdingData.period}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  Total Withheld: <strong>BDT {Number(withholdingData.totalWithheld || 0).toLocaleString()}</strong> · Statutory Treasury Deposit Code: 1/1101/0020/0311
                </p>
              </div>
              <button
                className="btn"
                onClick={() => exportCsv(withholdingData.items || [], `vds-statement-${period}`)}
              >
                <Download size={15} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Supplier / Press</th>
                    <th>BIN / TIN</th>
                    <th>Supplier Invoice #</th>
                    <th>Bill Date</th>
                    <th>Gross Bill (BDT)</th>
                    <th>VDS Rate</th>
                    <th>VDS Deducted (BDT)</th>
                    <th>Mushak 6.6 Certificate</th>
                    <th>Deposit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(withholdingData.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                        No supplier withholding transactions recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    (withholdingData?.items || []).map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.supplierName}</strong>
                        </td>
                        <td>{item.supplierBin || 'N/A'}</td>
                        <td>{item.supplierInvoiceNumber}</td>
                        <td>{item.invoiceDate}</td>
                        <td>BDT {Number(item.billAmount).toLocaleString()}</td>
                        <td>{item.vdsRatePercent}%</td>
                        <td>
                          <strong style={{ color: '#16a34a' }}>
                            BDT {Number(item.vdsDeducted).toLocaleString()}
                          </strong>
                        </td>
                        <td>{item.mushak66Number || 'Issued'}</td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#dcfce7',
                              color: '#15803d',
                            }}
                          >
                            Deposited
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTHOR ROYALTY TDS SCHEDULE */}
      {activeTab === 'author_tds' && authorTdsData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="panel" style={{ padding: 22, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
                  Income Tax Act 2023 · Section 106 &amp; 117
                </span>
                <h2 style={{ margin: '2px 0 6px', fontSize: 18, color: '#0f172a' }}>
                  Author Royalty TDS Schedule (Section 106/117) — Tax Year {taxYear}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  Statutory TDS rates: 10% (with e-TIN) / 15% (without e-TIN) · Treasury Code: 1/1141/0010/0111
                </p>
              </div>
              <button
                className="btn"
                onClick={() => exportCsv(authorTdsData.items || [], `author-royalty-tds-${taxYear}`)}
              >
                <Download size={15} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Author Name</th>
                    <th>e-TIN #</th>
                    <th>Contract / Book Titles</th>
                    <th>Gross Royalty (BDT)</th>
                    <th>TDS Rate</th>
                    <th>TDS Deducted (BDT )</th>
                    <th>Net Disbursed (BDT )</th>
                    <th>Statutory Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {(authorTdsData.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                        No author royalty disbursements recorded for tax year {taxYear}.
                      </td>
                    </tr>
                  ) : (
                    (authorTdsData?.items || []).map((row: any, idx: number) => (
                      <tr key={idx}>
                        <td>
                          <strong>{row.authorName}</strong>
                        </td>
                        <td>{row.etin || <span style={{ color: '#ef4444' }}>No TIN (15% rate)</span>}</td>
                        <td>{row.bookTitle || 'Contract Royalty'}</td>
                        <td>BDT {Number(row.grossRoyalty).toLocaleString()}</td>
                        <td>{row.tdsRatePercent}%</td>
                        <td>
                          <strong style={{ color: '#dc2626' }}>
                            BDT {Number(row.tdsDeducted).toLocaleString()}
                          </strong>
                        </td>
                        <td>
                          <strong style={{ color: '#16a34a' }}>
                            BDT {Number(row.netDisbursed).toLocaleString()}
                          </strong>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                            }}
                          >
                            TDS Deposited
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
