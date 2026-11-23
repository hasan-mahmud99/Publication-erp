/**
 * Standalone Client-Side & Edge Mock Service for Publishing ERP Enterprise
 * Enables 100% full-functionality showcase on Vercel with zero database or backend dependencies.
 */

import mockResponsesData from './mock-responses.json';
import mockDbData from './mock-db.json';

const mockResponses: Record<string, any> = mockResponsesData;
const mockDb: Record<string, any[]> = mockDbData as any;

export interface MockResponse<T = any> {
  status: number;
  data: T;
  headers?: Record<string, string>;
}

const DEFAULT_USER = {
  id: '2094d511-d2ca-49e7-aa16-5c9c6e497d27',
  organizationId: 'c3e31511-0a87-490c-9982-ef0b33d69b2c',
  email: 'admin@publishing-erp.local',
  fullName: 'Local Demo Administrator',
  displayName: 'Local Demo Administrator',
  role: 'Owner',
  status: 'active',
  permissions: [
    'workspace.read', 'workspace.create', 'workspace.update', 'workspace.delete', 'workspace.approve',
    'imports.read', 'imports.create', 'imports.approve', 'imports.confirm',
    'master-data.create', 'exports.create', 'users.manage',
    'finance.read', 'finance.post',
    'hr.read', 'hr.manage', 'hr.approve', 'hr.export',
    'editorial.read', 'editorial.manage', 'editorial.review', 'editorial.approve', 'editorial.export',
    'fair.finance', 'reports.export', 'reports.audit', 'tax.manage', 'production.manage'
  ]
};

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function getStoredMutations(): Record<string, any[]> {
  const s = getStorage();
  if (!s) return {};
  try {
    const raw = s.getItem('publishing_erp_mock_mutations');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMutation(collection: string, item: any) {
  const s = getStorage();
  if (!s) return;
  try {
    const current = getStoredMutations();
    if (!current[collection]) current[collection] = [];
    current[collection].unshift(item);
    s.setItem('publishing_erp_mock_mutations', JSON.stringify(current));
  } catch {}
}

export function handleMockRequest(rawPath: string, options: RequestInit = {}): MockResponse {
  const method = (options.method || 'GET').toUpperCase();
  const urlParts = rawPath.replace(/^\/api\/v1/, '').split('?');
  const path = urlParts[0].replace(/\/$/, '') || '/';
  const queryStr = urlParts[1] || '';
  const searchParams = new URLSearchParams(queryStr);

  let body: any = {};
  if (options.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = {};
    }
  }

  // 1. Auth routes
  if (path === '/auth/me') {
    return {
      status: 200,
      data: {
        data: {
          userId: DEFAULT_USER.id,
          organizationId: DEFAULT_USER.organizationId,
          email: DEFAULT_USER.email,
          fullName: DEFAULT_USER.fullName,
          role: DEFAULT_USER.role,
          permissions: DEFAULT_USER.permissions
        }
      }
    };
  }

  if (path === '/auth/login') {
    return {
      status: 200,
      data: {
        data: {
          accessToken: 'demo-jwt-token-' + Date.now(),
          user: DEFAULT_USER
        }
      }
    };
  }

  if (path === '/auth/logout') {
    return { status: 200, data: { success: true } };
  }

  // 2. Exact match in pre-recorded responses
  const fullPathWithQuery = queryStr ? `${path}?${queryStr}` : path;
  if (method === 'GET') {
    if (mockResponses[fullPathWithQuery]) {
      return { status: 200, data: JSON.parse(JSON.stringify(mockResponses[fullPathWithQuery])) };
    }
    if (mockResponses[path]) {
      return { status: 200, data: JSON.parse(JSON.stringify(mockResponses[path])) };
    }
  }

  // 3. Dynamic lookup patterns
  // /hr/employees/:id
  const empMatch = path.match(/^\/hr\/employees\/([a-f0-9-]+)$/i);
  if (empMatch) {
    const empId = empMatch[1];
    const employees = mockResponses['/hr/employees']?.data || mockDb.hr_employees || [];
    const found = employees.find((e: any) => e.id === empId || e.employee_code === empId);
    if (found) return { status: 200, data: { data: found } };
  }

  // /hr/employees/:id/assignments
  const empAssignMatch = path.match(/^\/hr\/employees\/([a-f0-9-]+)\/assignments$/i);
  if (empAssignMatch) {
    const empId = empAssignMatch[1];
    const assignments = (mockDb.hr_employee_assignment_events || []).filter((a: any) => a.employee_id === empId);
    return { status: 200, data: { data: assignments } };
  }

  // /hr/payroll-runs/:id/lines
  const payLinesMatch = path.match(/^\/hr\/payroll-runs\/([a-f0-9-]+)\/lines$/i);
  if (payLinesMatch) {
    const runId = payLinesMatch[1];
    if (mockResponses[path]) return { status: 200, data: mockResponses[path] };
    const lines = (mockDb.hr_payroll_lines || []).filter((l: any) => l.run_id === runId);
    return { status: 200, data: { data: lines } };
  }

  // /fair/events/:id/booths
  const boothMatch = path.match(/^\/fair\/events\/([a-f0-9-]+)\/booths$/i);
  if (boothMatch) {
    const fairId = boothMatch[1];
    if (mockResponses[path]) return { status: 200, data: mockResponses[path] };
    const booths = (mockDb.fair_booths || []).filter((b: any) => b.fair_id === fairId);
    return { status: 200, data: { data: booths } };
  }

  // /reports/fair-profitability
  if (path === '/reports/fair-profitability') {
    return {
      status: 200,
      data: mockResponses['/reports/fair-profitability'] || {
        data: {
          grossSales: 250197.15,
          discounts: 25019.72,
          netSales: 225177.43,
          directCostOfSales: 112588.72,
          grossProfit: 112588.71,
          totalExpenses: 659700.00,
          netProfitOrLoss: -547111.29,
          profitMarginPercent: -242.97
        }
      }
    };
  }

  // Dashboard endpoints
  if (path === '/dashboard/executive') {
    return {
      status: 200,
      data: {
        data: {
          books: 4,
          activeBooks: 2,
          orders: 14,
          orderValue: 70520,
          openPrintOrders: 2,
          onHand: 69750,
          reserved: 20,
          postedJournals: 41,
          canReadFinance: true
        }
      }
    };
  }

  if (path === '/dashboard/publishing') {
    return {
      status: 200,
      data: {
        data: {
          bookStatus: [
            { status: 'published', total: 2 },
            { status: 'in_production', total: 1 },
            { status: 'draft', total: 1 }
          ],
          pendingIdentifiers: 0
        }
      }
    };
  }

  if (path === '/dashboard/sales') {
    return {
      status: 200,
      data: {
        data: {
          status: [
            { status: 'draft', total: 2, order_value: 12400 },
            { status: 'confirmed', total: 5, order_value: 45000 },
            { status: 'dispatched', total: 4, order_value: 38500 },
            { status: 'delivered', total: 8, order_value: 70520 }
          ]
        }
      }
    };
  }

  if (path === '/dashboard/inventory') {
    return {
      status: 200,
      data: {
        data: {
          onHand: 69750,
          reserved: 20,
          available: 69730,
          stockValue: 14850000
        }
      }
    };
  }

  if (path === '/dashboard/trends') {
    return {
      status: 200,
      data: {
        data: {
          months: [
            { month: '2026-06', orders: 4, orderValue: 28500, titles: 2 },
            { month: '2026-07', orders: 6, orderValue: 42000, titles: 3 },
            { month: '2026-08', orders: 8, orderValue: 56000, titles: 4 },
            { month: '2026-09', orders: 11, orderValue: 78000, titles: 4 },
            { month: '2026-10', orders: 14, orderValue: 98000, titles: 5 },
            { month: '2026-11', orders: 18, orderValue: 125000, titles: 6 }
          ]
        }
      }
    };
  }

  if (path === '/dashboard/finance') {
    return {
      status: 200,
      data: {
        data: {
          status: [{ status: 'posted', total: 41 }],
          postedDebits: 16448115
        }
      }
    };
  }

  // /sales-sources/invoices/:id
  const invMatch = path.match(/^\/sales-sources\/invoices\/([a-f0-9-]+)$/i);
  if (invMatch) {
    const invId = invMatch[1];
    if (mockResponses[path]) return { status: 200, data: mockResponses[path] };
    const invs = mockDb.sales_invoices || [];
    const found = invs.find((i: any) => i.id === invId || i.invoice_number === invId);
    if (found) {
      const lines = (mockDb.sales_invoice_lines || []).filter((l: any) => l.invoice_id === found.id);
      return { status: 200, data: { data: { ...found, lines } } };
    }
  }

  // 4. Mutations (POST, PUT, PATCH, DELETE)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const generatedId = 'mock-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
    const createdItem = {
      id: generatedId,
      ...body,
      status: body.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveMutation(path, createdItem);

    // Custom responses for special mutations
    if (path.includes('/post-to-finance')) {
      return {
        status: 200,
        data: {
          data: {
            journalId: 'jv-mock-' + Date.now(),
            entryNumber: 'JV-PAY-' + Math.floor(1000 + Math.random() * 9000),
            taxTransactionNumber: 'TX-PAY-TDS-' + Math.floor(1000 + Math.random() * 9000),
            message: 'Payroll successfully posted to Finance GL.'
          }
        }
      };
    }

    if (path.includes('/transition')) {
      return {
        status: 200,
        data: {
          data: {
            id: path.split('/')[3] || generatedId,
            status: body.status || 'approved'
          }
        }
      };
    }

    return {
      status: 200,
      data: {
        success: true,
        data: createdItem
      }
    };
  }

  // 5. Fallback for any collection: search mockDb
  const collectionName = path.replace(/^\//, '').replace(/-/g, '_');
  if (mockDb[collectionName]) {
    return { status: 200, data: { data: mockDb[collectionName] } };
  }

  // Default empty list response
  return {
    status: 200,
    data: { data: [] }
  };
}

/**
 * Generates sample PDF or CSV Blob for document previews and exports
 */
export function generateMockBlob(path: string): Blob {
  const isPdf = path.includes('.pdf') || path.includes('/pdf') || path.includes('payslip') || path.includes('invoice');
  if (isPdf) {
    // Return a minimal valid A4 PDF stream
    const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 215 >> stream
BT
/F1 18 Tf
50 720 Td
(PUBLISHING ERP ENTERPRISE - OFFICIAL DOCUMENT) Tj
/F1 12 Tf
0 -30 Td
(Generated preview for: ${path}) Tj
0 -20 Td
(Status: Verified & Compliant | Approved by Chief Financial Officer) Tj
0 -20 Td
(Date: ${new Date().toLocaleDateString('en-GB')}) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000511 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
590
%%EOF`;
    return new Blob([pdfContent], { type: 'application/pdf' });
  }

  // Default CSV/Text
  const csvContent = `Document,Publishing ERP Export\nPath,${path}\nTimestamp,${new Date().toISOString()}\nStatus,Exported Successfully\n`;
  return new Blob([csvContent], { type: 'text/csv' });
}
