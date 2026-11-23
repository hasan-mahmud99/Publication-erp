export const dashboardImplementedScreens = new Set([
  'Executive Dashboard', 'Publishing Pipeline Dashboard', 'Sales Dashboard',
  'Inventory Dashboard', 'Production Dashboard', 'Finance Dashboard',
  'My Tasks', 'Global Search',
]);

export const catalogImplementedScreens = new Set([
  'Book Catalog List', 'Create Book', 'Edit Book', 'Book Detail & Timeline',
  'Edition List', 'Create/Edit Edition', 'Edition Detail',
  'ISBN & Identifier Register', 'Identifier Validation Queue',
  'Author/Contributor Assignment', 'Publisher & Imprint Management', 'Price List Management',
]);

export const financeImplementedScreens = new Set([
  'Finance Dashboard', 'Chart of Accounts', 'Journal Voucher List', 'Create Journal Voucher',
  'Journal Entry Detail', 'General Ledger', 'Trial Balance',
  'Accounts Receivable', 'Customer Ageing', 'Accounts Payable', 'Supplier Ageing', 'Payment Voucher',
  'Cash & Bank Accounts', 'Bank Reconciliation', 'Receipt Voucher',
  'Expense Register', 'Fixed Assets',
  'Profit & Loss / Balance Sheet / Cash Flow', 'Fiscal Period Close', 'Journal Reversal Register',
]);

export const inventoryImplementedScreens = new Set([
  'Inventory Overview', 'Stock by Book/Edition', 'Stock by Warehouse/Bin',
  'Inventory Transaction Ledger', 'Goods Receipt', 'Stock Issue', 'Stock Adjustment',
  'Stock Reconciliation', 'Inventory Valuation', 'Reserved & Available Stock',
  'Quarantine & Damaged Stock', 'Stock Transfer', 'Transfer Approval & Receipt',
  'In-Transit Stock', 'Physical Stock Count', 'Stock Count Variance Approval',
  'Inventory Movement Analysis', 'Slow-Moving Stock', 'Stock Ageing',
  'Reorder Planning',
  'Batch/Lot Register',
]);

export const adminImplementedScreens = new Set([
  'User Directory', 'User Profile & Access', 'Role & Permission Matrix',
]);

export const crmImplementedScreens = new Set([
  'CRM Dashboard', 'Customer Profile', 'Customer Contacts & Addresses',
  'Customer Segmentation', 'Opportunity Pipeline', 'Customer Activity Timeline',
  'Complaints & Disputes', 'Territory & Sales Assignment', 'Customer Duplicate Review',
]);

export const hrDedicatedScreens = new Set([
  'Employee Directory', 'Employee Profile', 'Department & Position Setup',
  'Attendance/Leave Register', 'Payroll Component Setup',
  'Payroll Processing & Review', 'Payroll Approval & Lock',
  'Payroll Journal & Payslip Register', 'Employee Advance & Claims',
  'Payroll Audit History',
]);

export const editorialDedicatedScreens = new Set([
  'Submission Inbox', 'Submit Manuscript', 'Manuscript Detail', 'Screening Queue',
  'Editorial Review', 'Reviewer Assignment', 'Editorial Task Board',
  'Editing & Proofreading Tracker', 'Version Comparison', 'Proof Approval',
  'Editorial Calendar', 'Rejection & Resubmission Register',
  'Manuscript File Repository', 'Editorial SLA Report', 'Review Conflict Check',
  'Publication Readiness Checklist',
]);

export const rightsAuthorScreens = new Set(['Author Directory', 'Author Profile']);
export const rightsContractScreens = new Set(['Contract List', 'Create/Edit Contract', 'Contract Detail & Amendments']);
export const rightsGrantsScreens = new Set(['Rights & Territory Register', 'Rights Expiry Calendar']);
export const rightsRoyaltyRulesScreens = new Set(['Royalty Rules Setup']);
export const rightsSplitsScreens = new Set(['Contributor Split Setup']);
export const rightsAdvancesScreens = new Set(['Advance Payment Register']);
export const rightsRoyaltyPreviewScreens = new Set(['Royalty Calculation Preview']);
export const rightsRoyaltyStatementsScreens = new Set(['Royalty Statement & Payment History']);
export const productionOrderScreens = new Set(['Production Planning Board', 'Print Order List', 'Create Print Order', 'Print Order Detail', 'Reprint Planning', 'Print Schedule Calendar']);
export const productionExecutionScreens = new Set(['Material Issue', 'WIP Tracking', 'Production Operations', 'Quality Inspection', 'Production Receipt', 'Wastage & Rejection Register', 'Finished Goods Acceptance', 'Paper Consumption Analysis']);
export const productionAnalysisScreens = new Set(['Planned vs Actual Cost', 'Printer Quotation Comparison', 'Production Variance Review', 'Print Order Closeout']);

export const ecommerceImplementedScreens = new Set([
  'Channel Integration Settings', 'Online Order Inbox', 'Online Order Detail',
  'Payment Reconciliation', 'Fulfilment Queue', 'Refund & Cancellation Queue',
  'Digital Product/Access Management', 'Digital Sales & Royalty Report',
  'Webhook Delivery Monitor', 'Channel Sync Exceptions',
]);
