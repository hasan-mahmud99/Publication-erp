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
    const booths = (mockDb.fair_booths || []).filter((b: any) => b.fair_id === fairId || b.event_id === fairId);
    return { status: 200, data: { data: booths } };
  }

  // /fair/events/:id/staff
  const fairStaffMatch = path.match(/^\/fair\/events\/([a-f0-9-]+)\/staff$/i);
  if (fairStaffMatch) {
    const fairId = fairStaffMatch[1];
    if (mockResponses[path]) return { status: 200, data: mockResponses[path] };
    const staff = (mockDb.fair_staff_assignments || []).filter((s: any) => s.fair_id === fairId || s.event_id === fairId);
    return {
      status: 200,
      data: {
        data: staff.length ? staff : [
          {
            id: 'staff-demo-1',
            event_id: fairId,
            booth_id: 'booth-demo-1',
            booth_code: 'B-01',
            booth_name: 'Main Pavilion Counter',
            user_id: '2c821459-2f6d-45c4-9b50-b92d20d6dff6',
            user_name: 'Tanvir Ahmed Chowdhury',
            user_email: 'tanvir@publishing-erp.local',
            staff_role: 'salesperson',
            shift_start: '2026-02-01T10:00:00Z',
            shift_end: '2026-02-28T21:00:00Z',
            status: 'active'
          },
          {
            id: 'staff-demo-2',
            event_id: fairId,
            booth_id: 'booth-demo-1',
            booth_code: 'B-01',
            booth_name: 'Main Pavilion Counter',
            user_id: '7949797a-dcc2-4d67-8b3c-a88774ade2f4',
            user_name: 'Mahmudul Haque',
            user_email: 'mahmud@publishing-erp.local',
            staff_role: 'cashier',
            shift_start: '2026-02-01T10:00:00Z',
            shift_end: '2026-02-28T21:00:00Z',
            status: 'active'
          }
        ]
      }
    };
  }

  // /fair/events/:id/stock
  const fairStockMatch = path.match(/^\/fair\/events\/([a-f0-9-]+)\/stock$/i);
  if (fairStockMatch) {
    const fairId = fairStockMatch[1];
    const fairs = mockDb.fair_events || [];
    const event = fairs.find((e: any) => e.id === fairId || e.event_code === fairId) || fairs[0] || {};
    const booths = (mockDb.fair_booths || []).filter((b: any) => b.fair_id === fairId || b.event_id === fairId);
    return {
      status: 200,
      data: {
        data: {
          event,
          booths,
          currentStock: [
            {
              item_id: 'item-001',
              item_code: 'BK-NOV-001',
              item_name: 'Nirbashito Shonglap (Hardcover)',
              warehouse_id: 'wh-fair-01',
              warehouse_name: 'Ekushey Pavilion Stall Warehouse',
              booth_code: 'B-01',
              booth_name: 'Main Pavilion Counter',
              on_hand_qty: 350,
              average_unit_cost: 145.00
            },
            {
              item_id: 'item-002',
              item_code: 'BK-POE-002',
              item_name: 'Dhulimukto Akash (Poetry Anthology)',
              warehouse_id: 'wh-fair-01',
              warehouse_name: 'Ekushey Pavilion Stall Warehouse',
              booth_code: 'B-01',
              booth_name: 'Main Pavilion Counter',
              on_hand_qty: 280,
              average_unit_cost: 95.00
            }
          ],
          transfers: [
            {
              id: 'tr-001',
              item_id: 'item-001',
              item_code: 'BK-NOV-001',
              source_warehouse_id: 'wh-central-01',
              destination_warehouse_id: 'wh-fair-01',
              source_warehouse_name: 'Central Dhaka Warehouse',
              destination_warehouse_name: 'Ekushey Pavilion Stall Warehouse',
              quantity: 500,
              received_qty: 500,
              status: 'received',
              created_at: '2026-01-28 14:00',
              received_at: '2026-01-28 17:30'
            }
          ],
          availableStock: [
            {
              warehouse_id: 'wh-central-01',
              warehouse_name: 'Central Dhaka Warehouse',
              warehouse_code: 'WH-DAC-01',
              item_id: 'item-001',
              item_code: 'BK-NOV-001',
              item_name: 'Nirbashito Shonglap (Hardcover)',
              on_hand_qty: 4500,
              average_unit_cost: 145.00
            }
          ]
        }
      }
    };
  }

  // /fair/events/:id/sales
  const fairSalesMatch = path.match(/^\/fair\/events\/([a-f0-9-]+)\/sales$/i);
  if (fairSalesMatch) {
    const fairId = fairSalesMatch[1];
    const fairs = mockDb.fair_events || [];
    const event = fairs.find((e: any) => e.id === fairId || e.event_code === fairId) || fairs[0] || {};
    const booths = (mockDb.fair_booths || []).filter((b: any) => b.fair_id === fairId || b.event_id === fairId);
    return {
      status: 200,
      data: {
        data: {
          event,
          booths,
          availableStock: [
            {
              item_id: 'item-001',
              warehouse_id: 'wh-fair-01',
              on_hand_qty: 350,
              average_unit_cost: 145.00,
              item_code: 'BK-NOV-001',
              item_name: 'Nirbashito Shonglap (Hardcover)',
              warehouse_name: 'Ekushey Pavilion Stall Warehouse',
              booth_id: 'booth-demo-1',
              booth_code: 'B-01',
              booth_name: 'Main Pavilion Counter',
              cover_price: 350.00
            }
          ],
          recentReceipts: (mockDb.fair_sales_receipts || []).slice(0, 20).map((r: any) => ({
            ...r,
            booth_id: r.booth_id || 'booth-demo-1',
            booth_code: r.booth_code || 'B-01',
            booth_name: r.booth_name || 'Main Pavilion Counter',
            cashier_name: r.cashier_name || 'Mahmudul Haque',
            lines: (mockDb.fair_sales_receipt_lines || []).filter((l: any) => l.receipt_id === r.id)
          })),
          kpis: {
            totalRevenue: 225177.43,
            totalCopiesSold: 840,
            totalReceipts: 142,
            cashTotal: 145000.00,
            mfsTotal: 65177.43,
            cardTotal: 15000.00
          }
        }
      }
    };
  }

  // /fair/events/:id/reports
  const fairReportsMatch = path.match(/^\/fair\/events\/([a-f0-9-]+)\/reports$/i);
  if (fairReportsMatch) {
    const fairId = fairReportsMatch[1];
    const fairs = mockDb.fair_events || [];
    const event = fairs.find((e: any) => e.id === fairId || e.event_code === fairId) || fairs[0] || {};
    return {
      status: 200,
      data: {
        data: {
          event,
          financialSummary: {
            grossSales: 250197.15,
            totalDiscounts: 25019.72,
            netSales: 225177.43,
            totalMemos: 142,
            totalCopiesSold: 840,
            salesTarget: Number(event.sales_target || 2500000),
            budgetAmount: Number(event.budget_amount || 650000),
            targetAchievementPct: 9.01,
            cogs: 112588.72,
            grossProfit: 112588.71,
            grossMarginPct: 50.00,
            totalExpenses: 659700.00,
            netProfit: -547111.29,
            netMarginPct: -242.97,
            roiPct: -82.93
          },
          salesByPaymentMethod: [
            { paymentMethod: 'cash', memoCount: 92, totalAmount: 145000.00, sharePct: 64.39 },
            { paymentMethod: 'bkash', memoCount: 41, totalAmount: 65177.43, sharePct: 28.95 },
            { paymentMethod: 'card', memoCount: 9, totalAmount: 15000.00, sharePct: 6.66 }
          ],
          dailySalesTrend: [
            { saleDate: '2026-02-01', memoCount: 18, netSales: 28400, discountAmount: 3150 },
            { saleDate: '2026-02-02', memoCount: 22, netSales: 35200, discountAmount: 3900 },
            { saleDate: '2026-02-03', memoCount: 31, netSales: 48900, discountAmount: 5400 },
            { saleDate: '2026-02-04', memoCount: 35, netSales: 56100, discountAmount: 6200 },
            { saleDate: '2026-02-05', memoCount: 36, netSales: 56577.43, discountAmount: 6369.72 }
          ],
          topSellingTitles: [
            {
              item_id: 'item-001',
              item_code: 'BK-NOV-001',
              item_name: 'Nirbashito Shonglap',
              copies_sold: 480,
              gross_sales: 168000,
              net_sales: 151200,
              cogs: 69600,
              gross_profit: 81600
            },
            {
              item_id: 'item-002',
              item_code: 'BK-POE-002',
              item_name: 'Dhulimukto Akash',
              copies_sold: 360,
              gross_sales: 82197.15,
              net_sales: 73977.43,
              cogs: 42988.72,
              gross_profit: 30988.71
            }
          ],
          boothPerformance: (mockDb.fair_booths || []).filter((b: any) => b.fair_id === fairId || b.event_id === fairId).map((b: any) => ({
            booth_id: b.id,
            booth_code: b.booth_code,
            booth_name: b.booth_name,
            total_memos: 142,
            copies_sold: 840,
            net_sales: 225177.43
          })),
          expenses: mockDb.fair_expenses || []
        }
      }
    };
  }

  // /fair/events/:id/post-fair-stock
  const postFairMatch = path.match(/^\/fair\/events\/([a-f0-9-]+)\/post-fair-stock$/i);
  if (postFairMatch) {
    const fairId = postFairMatch[1];
    const fairs = mockDb.fair_events || [];
    const event = fairs.find((e: any) => e.id === fairId || e.event_code === fairId) || fairs[0] || {};
    const booths = (mockDb.fair_booths || []).filter((b: any) => b.fair_id === fairId || b.event_id === fairId);
    return {
      status: 200,
      data: {
        data: {
          event,
          booths,
          centralWarehouses: [
            { id: 'wh-central-01', code: 'WH-DAC-01', name: 'Central Dhaka Warehouse', warehouse_type: 'central' },
            { id: 'wh-ctg-01', code: 'WH-CTG-01', name: 'Chattogram Branch Warehouse', warehouse_type: 'branch' }
          ],
          stockSummary: [
            {
              booth_id: 'booth-demo-1',
              booth_code: 'B-01',
              booth_name: 'Main Pavilion Counter',
              warehouse_id: 'wh-fair-01',
              warehouse_name: 'Ekushey Pavilion Stall Warehouse',
              item_id: 'item-001',
              item_code: 'BK-NOV-001',
              item_name: 'Nirbashito Shonglap (Hardcover)',
              edition_id: 'ed-001',
              current_stall_qty: 350,
              average_unit_cost: 145.00,
              cover_price: 350.00,
              allocated_qty: 500,
              sold_qty: 150,
              returned_qty: 0
            }
          ],
          returnTransfers: [],
          kpis: {
            totalAllocatedCopies: 500,
            totalCopiesSold: 150,
            totalCurrentInStall: 350,
            totalReturnedCopies: 0,
            totalRemainingValue: 122500.00
          }
        }
      }
    };
  }

  // /fair/events/:id (Single Event Details with History)
  const fairEventDetailMatch = path.match(/^\/fair\/events\/([a-f0-9-]+)$/i);
  if (fairEventDetailMatch) {
    const fairId = fairEventDetailMatch[1];
    const fairs = mockDb.fair_events || [];
    const found = fairs.find((e: any) => e.id === fairId || e.event_code === fairId) || fairs[0];
    if (found) {
      return {
        status: 200,
        data: {
          data: {
            event: found,
            history: [
              {
                action: 'FAIR_CREATE',
                from_status: null,
                to_status: 'draft',
                reason: 'Event initialized during 2026 annual planning',
                occurred_at: '2026-01-10T09:00:00Z',
                actor_name: 'Hasan Mahmud (Admin)'
              },
              {
                action: 'FAIR_SUBMIT',
                from_status: 'draft',
                to_status: 'submitted',
                reason: 'Budget and booth allocation ready for review',
                occurred_at: '2026-01-15T11:30:00Z',
                actor_name: 'Hasan Mahmud (Admin)'
              },
              {
                action: 'FAIR_APPROVE',
                from_status: 'submitted',
                to_status: 'approved',
                reason: 'Management approved operational plan and credit limit',
                occurred_at: '2026-01-16T14:15:00Z',
                actor_name: 'Managing Director'
              }
            ]
          }
        }
      };
    }
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
