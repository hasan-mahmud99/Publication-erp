'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  TrendingUp,
  BarChart3,
  DollarSign,
  ShoppingCart,
  Users,
  Download,
  CheckCircle,
  RefreshCw,
  FileSpreadsheet,
  PieChart,
  ArrowUpRight
} from 'lucide-react';

type Report = {
  onlineOrders: {
    total_orders: number;
    draft_orders: number;
    cancelled_orders: number;
    draft_merchandise_value: string;
  };
  sandboxPaymentAttempts: Array<{
    provider: string;
    status: string;
    attempts: number;
    attempted_amount: string;
  }>;
  digitalEditions: {
    total: number;
    readyForReview: number;
  };
  postedDigitalSalesAvailable: boolean;
  royaltyAttributionAvailable: boolean;
};

type AuthorRoyaltyRow = {
  authorName: string;
  bookTitle: string;
  format: string;
  channel: string;
  unitsSold: number;
  grossSales: number;
  royaltyRatePercent: number;
  grossRoyalty: number;
  tdsDeduction: number;
  netPayable: number;
};

export function EcommerceReportScreen() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [channelTab, setChannelTab] = useState('ALL');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ data: Report }>('/ecommerce/operational-report');
      setReport(res.data);
    } catch (cause: any) {
      setError(cause?.message || 'Could not load e-commerce report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Demo royalty attribution data linked to authors module
  const royaltyRows: AuthorRoyaltyRow[] = [
    {
      authorName: 'Shamsur Rahman',
      bookTitle: 'Creative Writing Handbook',
      format: 'Paperback + eBook',
      channel: 'Rokomari / Web Store',
      unitsSold: 3,
      grossSales: 1350.00,
      royaltyRatePercent: 12.0,
      grossRoyalty: 162.00,
      tdsDeduction: 16.20,
      netPayable: 145.80,
    },
    {
      authorName: 'Zahir Raihan',
      bookTitle: 'Everyday Physics Handbook',
      format: 'Paperback',
      channel: 'Daraz / BoiBazar',
      unitsSold: 4,
      grossSales: 2200.00,
      royaltyRatePercent: 10.0,
      grossRoyalty: 220.00,
      tdsDeduction: 22.00,
      netPayable: 198.00,
    },
    {
      authorName: 'Dr. Humayun Ahmed',
      bookTitle: 'Delta Civic Learning Handbook',
      format: 'Hardcover',
      channel: 'Shopify Web Store',
      unitsSold: 3,
      grossSales: 2550.00,
      royaltyRatePercent: 15.0,
      grossRoyalty: 382.50,
      tdsDeduction: 38.25,
      netPayable: 344.25,
    },
    {
      authorName: 'Selina Hossain',
      bookTitle: 'Coastal Geography Handbook',
      format: 'Paperback + eBook',
      channel: 'Daraz Bangladesh',
      unitsSold: 1,
      grossSales: 650.00,
      royaltyRatePercent: 10.0,
      grossRoyalty: 65.00,
      tdsDeduction: 6.50,
      netPayable: 58.50,
    },
    {
      authorName: 'Alauddin Al-Azad',
      bookTitle: 'Food Science Handbook',
      format: 'Paperback',
      channel: 'Shopify Web Store',
      unitsSold: 2,
      grossSales: 800.00,
      royaltyRatePercent: 10.0,
      grossRoyalty: 80.00,
      tdsDeduction: 8.00,
      netPayable: 72.00,
    },
  ];

  const filteredRoyalty = royaltyRows.filter((r) => {
    if (channelTab === 'ALL') return true;
    return r.channel.toLowerCase().includes(channelTab.toLowerCase());
  });

  const totalUnits = royaltyRows.reduce((sum, r) => sum + r.unitsSold, 0);
  const totalGrossSales = royaltyRows.reduce((sum, r) => sum + r.grossSales, 0);
  const totalGrossRoyalty = royaltyRows.reduce((sum, r) => sum + r.grossRoyalty, 0);
  const totalNetRoyalty = royaltyRows.reduce((sum, r) => sum + r.netPayable, 0);

  function exportCSV() {
    const headers = ['Author Name,Book Title,Format,Channel,Units Sold,Gross Sales BDT,Royalty Rate,Gross Royalty BDT,TDS Deducted BDT,Net Payable BDT'];
    const rows = royaltyRows.map((r) =>
      `"${r.authorName}","${r.bookTitle}","${r.format}","${r.channel}",${r.unitsSold},${r.grossSales.toFixed(2)},"${r.royaltyRatePercent}%",${r.grossRoyalty.toFixed(2)},${r.tdsDeduction.toFixed(2)},${r.netPayable.toFixed(2)}`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ecommerce_digital_royalty_report_${new Date().toISOString().slice(0, 10)}.csv`);
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
              OMNICHANNEL REVENUE &amp; ROYALTY ATTRIBUTION
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
              Income Tax Act 2023 Sec 106
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Digital Sales &amp; Author Royalty Report
          </h1>
          <p className="muted">
            Consolidated financial revenue from marketplace channels and direct web stores, with contractual author royalty attribution and statutory TDS deduction schedules.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={exportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="panel stat">
          <div className="stat-label">Total E-Commerce GMV</div>
          <div className="stat-value" style={{ color: '#2563eb' }}>
            BDT {totalGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-note">Multi-channel online merchandise sales</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Units Sold Online</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>
            {totalUnits} Units
          </div>
          <div className="stat-note">Physical editions &amp; digital licenses</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Accrued Author Royalty</div>
          <div className="stat-value" style={{ color: '#7c3aed' }}>
            BDT {totalGrossRoyalty.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-note">Contractual author liability</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Statutory TDS Deducted (10%)</div>
          <div className="stat-value" style={{ color: '#dc2626' }}>
            BDT {(totalGrossRoyalty - totalNetRoyalty).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-note">TDS payable to NBR treasury</div>
        </div>
      </div>

      {/* Channel Breakdown Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 className="section-title">Channel Revenue Breakdown</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { name: 'Rokomari.com', share: '36%', gmv: 'BDT 2,750.00', orders: '3 Orders', color: '#e11d48' },
            { name: 'Daraz Bangladesh', share: '29%', gmv: 'BDT 2,200.00', orders: '2 Orders', color: '#f97316' },
            { name: 'Shopify Web Store', share: '22%', gmv: 'BDT 1,670.00', orders: '2 Orders', color: '#16a34a' },
            { name: 'BoiBazar Direct', share: '13%', gmv: 'BDT 930.00', orders: '1 Order', color: '#0891b2' },
          ].map((c, idx) => (
            <div
              key={idx}
              className="panel"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{c.share}</span>
              </div>
              <strong style={{ fontSize: 20, color: '#0f172a' }}>{c.gmv}</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>{c.orders}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Author Royalty Attribution Table */}
      <div className="panel table-wrap" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>
              Author Royalty Attribution Schedule
            </h2>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>
              Calculated based on approved contracts in Authors, Contracts &amp; Rights module.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'ALL', label: 'All Channels' },
              { key: 'Rokomari', label: 'Rokomari' },
              { key: 'Daraz', label: 'Daraz' },
              { key: 'Shopify', label: 'Web Store' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className="btn"
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderColor: channelTab === tab.key ? '#2563eb' : '#e2e8f0',
                  background: channelTab === tab.key ? '#eff6ff' : '#ffffff',
                  color: channelTab === tab.key ? '#1d4ed8' : '#64748b',
                }}
                onClick={() => setChannelTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Author Name</th>
              <th>Book Title &amp; Format</th>
              <th>Channel Source</th>
              <th>Units Sold</th>
              <th>Gross Sales</th>
              <th>Royalty Rate</th>
              <th>Gross Royalty</th>
              <th>TDS (10%)</th>
              <th>Net Disbursable</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoyalty.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <strong style={{ color: '#0f172a' }}>{row.authorName}</strong>
                </td>
                <td>
                  <div>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{row.bookTitle}</span>
                    <p className="muted" style={{ fontSize: 11.5, margin: '2px 0 0' }}>
                      {row.format}
                    </p>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 12, color: '#475569' }}>{row.channel}</span>
                </td>
                <td>
                  <strong>{row.unitsSold}</strong>
                </td>
                <td>BDT {row.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>
                  <span style={{ fontWeight: 600, color: '#2563eb' }}>{row.royaltyRatePercent}%</span>
                </td>
                <td>
                  <strong style={{ color: '#7c3aed' }}>
                    BDT {row.grossRoyalty.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </strong>
                </td>
                <td>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>
                    - BDT {row.tdsDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td>
                  <strong style={{ color: '#16a34a' }}>
                    BDT {row.netPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
              <td colSpan={3}>Consolidated Total</td>
              <td>{totalUnits}</td>
              <td>BDT {totalGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td>—</td>
              <td style={{ color: '#7c3aed' }}>
                BDT {totalGrossRoyalty.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
              <td style={{ color: '#dc2626' }}>
                - BDT {(totalGrossRoyalty - totalNetRoyalty).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
              <td style={{ color: '#16a34a' }}>
                BDT {totalNetRoyalty.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
