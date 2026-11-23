import type { Screen } from './screens';

export type DraftField = { key: string; label: string; type?: 'text' | 'date' | 'number' | 'select' | 'textarea'; required?: boolean; options?: string[] };
export type DraftMode = 'list' | 'form' | 'queue' | 'report' | 'calendar' | 'detail' | 'board' | 'comparison' | 'history' | 'export' | 'setup' | 'directory' | 'register' | 'transaction';
export type DraftSpec = { mode: DraftMode; fields: DraftField[]; recordLabel: string; focus: string; dateKey?: string; purpose: string; primaryAction: string };
const text = (key: string, label: string, required = true): DraftField => ({ key, label, required });
const day = (key: string, label: string, required = true): DraftField => ({ key, label, type: 'date', required });
const number = (key: string, label: string, required = true): DraftField => ({ key, label, type: 'number', required });
const choice = (key: string, label: string, options: string[]): DraftField => ({ key, label, type: 'select', options, required: true });
const note = (key = 'note', label = 'Notes'): DraftField => ({ key, label, type: 'textarea', required: false });

const base: Record<string, { fields: DraftField[]; label: string; focus: string }> = {
  'publishing-catalog': { fields: [text('title', 'Book title'), text('edition', 'Edition / format', false), day('targetDate', 'Target date', false), note()], label: 'catalog item', focus: 'Book and edition metadata' },
  'manuscript-editorial': { fields: [text('manuscriptTitle', 'Manuscript title'), text('contributor', 'Contributor'), day('receivedDate', 'Received date'), choice('stage', 'Editorial stage', ['submission', 'screening', 'review', 'proof', 'ready']), note()], label: 'manuscript', focus: 'Submission, review and proof details' },
  'authors-contracts-rights': { fields: [text('author', 'Author / contributor'), text('contractReference', 'Contract reference'), day('effectiveDate', 'Effective date'), text('territory', 'Territory / rights scope'), note()], label: 'rights record', focus: 'Author, contract and rights terms' },
  'printing-production': { fields: [text('printOrder', 'Print order reference'), text('edition', 'Book / edition'), number('plannedCopies', 'Planned copies'), day('dueDate', 'Due date'), note()], label: 'production record', focus: 'Print planning, quantity and timing' },
  'suppliers': { fields: [text('supplier', 'Supplier'), text('documentReference', 'Document reference'), number('amount', 'Estimated amount (BDT)', false), day('requiredDate', 'Required date'), note()], label: 'supplier record', focus: 'Supplier master and payment details' },
  'procurement-suppliers': { fields: [text('supplier', 'Supplier'), text('documentReference', 'Document reference'), number('amount', 'Estimated amount (BDT)', false), day('requiredDate', 'Required date'), note()], label: 'procurement record', focus: 'Supplier and purchasing details' },
  'inventory-warehouse': { fields: [text('item', 'Item / edition'), text('warehouse', 'Warehouse / bin'), number('quantity', 'Quantity'), day('asOfDate', 'As-of date'), note()], label: 'stock record', focus: 'Warehouse, item and quantity' },
  'sales-distribution': { fields: [text('customer', 'Customer / distributor'), text('orderReference', 'Order reference'), number('amount', 'Order value (BDT)', false), day('orderDate', 'Order date'), note()], label: 'sales record', focus: 'Customer and order details' },
  'returns-claims': { fields: [text('returnReference', 'Return reference'), text('sourceDocument', 'Original sale / purchase'), number('quantity', 'Quantity'), text('reason', 'Return reason'), note()], label: 'return record', focus: 'Return source, inspection and disposition' },
  'finance-accounting': { fields: [text('documentReference', 'Document reference'), text('account', 'Account / cost centre'), number('amount', 'Amount (BDT)'), day('postingDate', 'Posting date'), note()], label: 'finance record', focus: 'Accounting reference and amount' },
  'vat-tax': { fields: [text('taxRule', 'Tax rule / classification'), text('documentReference', 'Tax document'), number('taxableAmount', 'Taxable amount (BDT)'), number('taxAmount', 'Tax amount (BDT)'), day('taxDate', 'Tax date')], label: 'tax record', focus: 'Taxable values and documentary evidence' },
  'crm-customers': { fields: [text('customer', 'Customer'), day('periodStart', 'Period start'), day('periodEnd', 'Period end'), number('revenue', 'Revenue (BDT)'), number('cost', 'Cost (BDT)')], label: 'customer analysis', focus: 'Customer value and costs' },
  'book-fair-events': { fields: [text('fair', 'Fair / event'), text('venue', 'Venue'), day('eventDate', 'Event date'), number('amount', 'Amount (BDT)', false), note()], label: 'fair record', focus: 'Event, stock and settlement details' },
  'marketing-promotions': { fields: [text('campaign', 'Campaign / promotion'), text('channel', 'Channel'), day('startDate', 'Start date'), day('endDate', 'End date'), number('budget', 'Budget (BDT)', false)], label: 'campaign record', focus: 'Eligibility, dates and budget' },
  'ecommerce-digital': { fields: [text('channel', 'Online channel'), text('externalReference', 'External reference'), day('eventDate', 'Event date'), text('eventType', 'Event / product type'), note()], label: 'digital record', focus: 'Channel transaction and sync details' },
  'reports-analytics': { fields: [text('reportName', 'Report / dataset'), day('fromDate', 'From date'), day('toDate', 'To date'), text('scope', 'Scope / filters'), note()], label: 'report definition', focus: 'Period, source and filter definition' },
  'workflow-approvals': { fields: [text('documentType', 'Document type'), text('approver', 'Approver / role'), number('limit', 'Approval limit (BDT)', false), day('dueDate', 'Due date', false), note()], label: 'approval record', focus: 'Rule, approver and decision context' },
  'notifications-tasks': { fields: [text('subject', 'Subject'), text('recipient', 'Recipient / role'), choice('channel', 'Channel', ['in-app', 'email', 'sms']), day('scheduledDate', 'Scheduled date', false), note('message', 'Message')], label: 'notification record', focus: 'Recipient, channel and delivery context' },
  'administration-security': { fields: [text('setting', 'Setting / policy'), text('scope', 'Organization / branch scope'), day('effectiveDate', 'Effective date', false), note('reason', 'Change reason')], label: 'administration record', focus: 'Configuration, scope and audit reason' },
};

const overrides: Array<{ module: string; match: RegExp; fields: DraftField[]; focus: string }> = [
  { module: 'manuscript-editorial', match: /Review|Reviewer|Conflict|Screening/, fields: [text('manuscriptTitle', 'Manuscript'), text('reviewer', 'Reviewer'), day('dueDate', 'Review due date'), choice('recommendation', 'Recommendation', ['pending', 'accept', 'revise', 'reject']), note('reviewNotes', 'Review notes')], focus: 'Reviewer assignment and recommendation' },
  { module: 'manuscript-editorial', match: /Proof|Version|Editing/, fields: [text('manuscriptTitle', 'Manuscript'), text('version', 'File version'), day('proofDate', 'Proof date'), choice('proofStatus', 'Proof status', ['draft', 'in_review', 'corrections', 'accepted']), note('changes', 'Changes / corrections')], focus: 'Version and proof decisions' },
  { module: 'authors-contracts-rights', match: /Royalty|Contributor Split/, fields: [text('contributor', 'Contributor'), text('contractReference', 'Contract reference'), number('rate', 'Royalty / split rate (%)'), day('periodEnd', 'Period end'), note('basis', 'Calculation basis')], focus: 'Royalty basis and contributor allocation' },
  { module: 'authors-contracts-rights', match: /Advance Payment/, fields: [text('author', 'Author'), text('contractReference', 'Contract'), number('amount', 'Advance amount (BDT)'), day('paymentDate', 'Payment date'), note()], focus: 'Contract advance and payment reference' },
  { module: 'printing-production', match: /Material|BOM|Paper Consumption/, fields: [text('printOrder', 'Print order'), text('material', 'Material / paper'), number('requiredQty', 'Required quantity'), number('issuedQty', 'Issued quantity', false), note()], focus: 'Material requirement and consumption' },
  { module: 'printing-production', match: /Quality|Wastage|Rejection|Acceptance/, fields: [text('printOrder', 'Print order'), text('inspectionLot', 'Inspection lot'), number('inspectedQty', 'Inspected copies'), number('rejectedQty', 'Rejected copies'), note('finding', 'Inspection finding')], focus: 'Inspection and accepted quantity' },
  { module: 'procurement-suppliers', match: /RFQ|Quotation|Comparison/, fields: [text('supplier', 'Supplier'), text('rfqReference', 'RFQ reference'), number('quotedAmount', 'Quoted amount (BDT)'), day('validUntil', 'Valid until'), note('terms', 'Terms')], focus: 'Quotation terms and comparison' },
  { module: 'procurement-suppliers', match: /Goods Receipt|Purchase Return/, fields: [text('purchaseOrder', 'Purchase order'), text('supplier', 'Supplier'), text('item', 'Item'), number('quantity', 'Received / returned quantity'), day('receiptDate', 'Receipt date')], focus: 'Received goods and source order' },
  { module: 'inventory-warehouse', match: /Reorder|Ageing|Slow-Moving/, fields: [text('item', 'Item'), text('warehouse', 'Warehouse'), number('onHand', 'On-hand quantity'), number('threshold', 'Threshold / age in days'), day('asOfDate', 'As-of date')], focus: 'Replenishment and stock age' },
  { module: 'sales-distribution', match: /Credit|Collection|Receipt/, fields: [text('customer', 'Customer'), text('invoiceReference', 'Invoice / receipt reference'), number('amount', 'Amount (BDT)'), day('dueDate', 'Due / receipt date'), note('allocation', 'Allocation notes')], focus: 'Credit exposure and collections' },
  { module: 'sales-distribution', match: /Delivery|Dispatch|Pick|Pack/, fields: [text('orderReference', 'Sales order'), text('customer', 'Customer'), text('warehouse', 'Dispatch warehouse'), number('quantity', 'Quantity'), day('dispatchDate', 'Dispatch date')], focus: 'Fulfilment and delivery tracking' },
  { module: 'returns-claims', match: /Inspection|Disposition/, fields: [text('returnReference', 'Return request'), text('item', 'Item / edition'), number('receivedQty', 'Received quantity'), number('acceptedQty', 'Accepted quantity'), note('inspection', 'Inspection / disposition')], focus: 'Inspection result and disposition' },
  { module: 'finance-accounting', match: /Bank|Cash/, fields: [text('bankAccount', 'Bank / cash account'), text('statementReference', 'Statement / transaction reference'), number('amount', 'Amount (BDT)'), day('transactionDate', 'Transaction date'), note('matching', 'Matching notes')], focus: 'Bank movement and reconciliation' },
  { module: 'vat-tax', match: /Rules|Configuration|Mapping/, fields: [text('taxCode', 'Tax code'), text('classification', 'Classification'), number('rate', 'Tax rate (%)'), day('effectiveFrom', 'Effective from'), note('basis', 'Rule basis')], focus: 'Effective tax rules and classification' },
  { module: 'book-fair-events', match: /Stock|Reconciliation/, fields: [text('fair', 'Fair / event'), text('item', 'Book / edition'), number('issuedQty', 'Issued quantity'), number('returnedQty', 'Returned quantity'), day('asOfDate', 'As-of date')], focus: 'Fair stock allocation and settlement' },
  { module: 'marketing-promotions', match: /Discount|Promotion|Conflict/, fields: [text('promotion', 'Promotion'), text('productScope', 'Eligible book / channel'), number('discountRate', 'Discount rate (%)'), day('startDate', 'Start date'), day('endDate', 'End date')], focus: 'Promotion eligibility and conflicts' },
  { module: 'ecommerce-digital', match: /Webhook|Sync|Integration/, fields: [text('channel', 'Channel'), text('eventId', 'External event ID'), choice('eventType', 'Event type', ['order', 'payment', 'refund', 'catalog']), day('receivedDate', 'Received date'), note('response', 'Delivery / error detail')], focus: 'External event and sync status' },
  { module: 'workflow-approvals', match: /Delegation|Escalation/, fields: [text('fromRole', 'Delegating role'), text('toRole', 'Delegate / escalation role'), day('startDate', 'Start date'), day('endDate', 'End date'), note('reason', 'Reason')], focus: 'Delegation period and escalation route' },
  { module: 'notifications-tasks', match: /Template|Preferences|Rules/, fields: [text('templateKey', 'Template / rule key'), choice('channel', 'Delivery channel', ['in-app', 'email', 'sms']), text('recipientRole', 'Recipient role'), day('effectiveDate', 'Effective date', false), note('message', 'Template message')], focus: 'Template and delivery preferences' },
  { module: 'administration-security', match: /Session|MFA|API Client|Integration|Webhook/, fields: [text('policyName', 'Policy / integration name'), text('scope', 'Access scope'), day('effectiveDate', 'Effective date', false), note('control', 'Security control / review')], focus: 'Security configuration and access scope' },
];

// A screen-specific datum distinguishes related registers without inventing a posting engine.
const distinct: Record<string, DraftField> = {
  'Bulk Import Preview': text('sourceFile', 'Source file name'),
  'Discontinued Titles': day('discontinuedOn', 'Discontinued on'),
  'Digital Format Register': text('digitalFormat', 'Digital format'),
  'Book Metadata Completeness': text('missingMetadata', 'Missing metadata fields'),
  'Catalog Export': text('exportColumns', 'Export column set'),
  'Catalog Change History': text('changeReason', 'Change reason'),
  'Editorial Review': text('assessment', 'Editorial assessment'),
  'Reviewer Assignment': text('assignedReviewer', 'Assigned reviewer'),
  'Review Conflict Check': text('conflictType', 'Conflict type'),
  'Rejection & Resubmission Register': day('resubmissionDue', 'Resubmission due'),
  'Manuscript File Repository': text('fileVersion', 'File version'),
  'Publication Readiness Checklist': text('outstandingChecks', 'Outstanding checks'),
  'Version Comparison': text('compareWithVersion', 'Compare with version'),
  'Contract List': text('contractType', 'Contract type'),
  'Rights & Territory Register': text('rightsType', 'Rights type'),
  'Contract Detail & Amendments': text('amendmentNumber', 'Amendment number'),
  'Contributor Split Setup': number('splitPercent', 'Contributor share (%)'),
  'Print Order List': choice('printStatus', 'Print status', ['draft', 'scheduled', 'in_production', 'complete']),
  'Print Specification Sheet': text('trimSize', 'Trim size / binding'),
  'WIP Tracking': text('operationStage', 'Current operation stage'),
  'Production Operations': text('machine', 'Machine / process'),
  'Production Receipt': number('receivedCopies', 'Received copies'),
  'Reprint Planning': text('reprintReason', 'Reprint reason'),
  'Planned vs Actual Cost': number('actualCost', 'Actual cost (BDT)'),
  'Printer Quotation Comparison': text('printerName', 'Quoted printer'),
  'Production Batch History': text('batchNumber', 'Batch number'),
  'Material Issue': number('issuedQty', 'Issued quantity'),
  'Wastage & Rejection Register': number('wastageQty', 'Wastage quantity'),
  'Finished Goods Acceptance': number('acceptedCopies', 'Accepted copies'),
  'Print Order Closeout': day('closedOn', 'Closeout date'),
  'Purchase Requisition List': text('requestingDepartment', 'Requesting department'),
  'Purchase Order List': text('purchaseOrderNumber', 'Purchase order number'),
  'Supplier Bill Register': text('supplierInvoice', 'Supplier invoice number'),
  'Supplier Advance Register': number('advanceAmount', 'Supplier advance (BDT)'),
  'Supplier Payment Allocation': text('paymentReference', 'Payment reference'),
  'Purchase Order Detail': text('deliveryTerms', 'Delivery terms'),
  'PO Change History': text('changeOrder', 'Change order number'),
  'Create/Edit Purchase Order': text('purchaseOrderNumber', 'Purchase order number'),
  'Quotation Comparison': number('comparisonPrice', 'Comparison price (BDT)'),
  'Purchase Return & Debit Note': text('debitNoteNumber', 'Debit note number'),
  'Slow-Moving Stock': number('daysSinceSale', 'Days since last sale'),
  'Sales Quotation List': text('quotationNumber', 'Quotation number'),
  'Sales Order List': text('salesOrderNumber', 'Sales order number'),
  'Sales Invoice List': text('invoiceNumber', 'Invoice number'),
  'Distributor Commission Settlement': number('commissionRate', 'Commission rate (%)'),
  'Backorder Management': number('backorderQty', 'Backorder quantity'),
  'Sales Return Eligibility Preview': text('originalInvoice', 'Original invoice'),
  'Create Sales Order': text('purchaseOrderRef', 'Customer purchase order'),
  'Customer Order History': day('fulfilledOn', 'Fulfilled on'),
  'Credit Limit Review': number('creditLimit', 'Credit limit (BDT)'),
  'Delivery/Dispatch Register': text('trackingNumber', 'Tracking number'),
  'Consignment Dispatch & Settlement': number('consignmentQty', 'Consignment quantity'),
  'Delivery Tracking': choice('deliveryStatus', 'Delivery status', ['pending', 'dispatched', 'delivered', 'exception']),
  'Price & Discount Override Approval': number('overridePercent', 'Override discount (%)'),
  'Sales Credit Note': text('creditNoteNumber', 'Credit note number'),
  'Refund & Replacement Register': text('refundReference', 'Refund / replacement reference'),
  'Supplier/Printer Claim Register': text('claimReference', 'Claim reference'),
  'Return Disposition': choice('disposition', 'Disposition', ['restock', 'quarantine', 'replace', 'refund']),
  'Unreferenced Return Exception': text('exceptionReason', 'Missing-reference reason'),
  'Accounts Payable': text('supplierInvoice', 'Supplier invoice'),
  'Payment Voucher': text('payee', 'Payee'),
  'Receipt Voucher': text('payer', 'Payer'),
  'Expense Register': text('expenseCategory', 'Expense category'),
  'Fixed Assets': text('assetCode', 'Asset code'),
  'Unapplied Receipts & Payments': text('unappliedReason', 'Unapplied reason'),
  'Budget vs Actual': number('budgetAmount', 'Budget (BDT)'),
  'Financial Audit Trail': text('auditEvent', 'Audit event'),
  'Supplier Ageing': text('supplier', 'Supplier'),
  'Effective-Dated Tax Rules': day('effectiveFrom', 'Rule effective from'),
  'Tax Classification Mapping': text('taxClass', 'Tax class'),
  'Tax Document Register': text('documentNumber', 'Tax document number'),
  'Tax Compliance Checklist': text('filingPeriod', 'Filing period'),
  'Credit/Debit Note Tax Review': text('sourceNote', 'Credit / debit note'),
  'Fair Expense Register': text('expenseType', 'Expense type'),
  'Fair Setup & Booth': text('boothNumber', 'Booth number'),
  'Fair Sales Entry': number('copiesSold', 'Copies sold'),
  'Post-Fair Stock Reconciliation': number('closingQty', 'Closing quantity'),
  'Event/Launch Planner': text('launchBook', 'Launch book'),
  'Payment Reconciliation': text('gatewayReference', 'Payment gateway reference'),
  'Fulfilment Queue': text('fulfilmentMethod', 'Fulfilment method'),
  'Refund & Cancellation Queue': text('refundReason', 'Refund reason'),
  'Channel Sync Exceptions': text('retryReason', 'Sync exception reason'),
  'Sales & Returns Reports': text('salesChannel', 'Sales channel'),
  'Inventory Reports': text('warehouseScope', 'Warehouse scope'),
  'Production Cost Reports': text('costType', 'Production cost type'),
  'Royalty Liability Reports': text('royaltyContract', 'Royalty contract'),
  'Customer/Supplier Ageing Reports': number('ageBucket', 'Age bucket (days)'),
  'Financial Statements': text('statementType', 'Statement type'),
  'Book/Fair Profitability Reports': text('profitCentre', 'Book / fair profit centre'),
  'Data Quality & Reconciliation Report': text('qualityRule', 'Data quality rule'),
  'Operational KPI Dashboard': text('kpiName', 'KPI name'),
  'Publisher/Imprint Performance': text('imprint', 'Publisher / imprint'),
  'Edition Lifecycle Analytics': text('editionStage', 'Edition lifecycle stage'),
  'Sales Forecast Report': text('forecastMethod', 'Forecast method'),
  'Report Access Audit': text('reportUser', 'Report user'),
  'Approval Rule Builder': text('ruleCondition', 'Rule condition'),
  'Approval Matrix': text('approvalLevel', 'Approval level'),
  'Approval Limit Simulator': number('simulatedAmount', 'Simulated amount (BDT)'),
  'Workflow Exception Queue': text('exceptionCode', 'Exception code'),
  'Notification Templates': text('templateBody', 'Template body'),
  'Alert Delivery Preferences': text('quietHours', 'Quiet hours'),
  'Branch & Warehouse Setup': text('branchCode', 'Branch / warehouse code'),
  'Fiscal Year & Period Controls': day('periodOpeningDate', 'Period opening date'),
  'Document Numbering Setup': text('numberPattern', 'Document number pattern'),
  'Language & Localization Settings': text('localeCode', 'Locale code'),
  'Module Feature Configuration': text('featureKey', 'Feature key'),
  'Backup & Restore Operations': text('backupReference', 'Backup reference'),
  'Data Retention & Export Policy': number('retentionDays', 'Retention days'),
  'Security Incident Register': text('incidentReference', 'Incident reference'),
  'Approval Separation-of-Duties Policy': text('conflictingRoles', 'Conflicting roles'),
  'API Client Management': text('clientName', 'API client name'),
};

// Editorial screens need their own data questions and working surfaces. A single
// manuscript form cannot represent intake, review, proofs and publication checks.
const editorial: Record<string, Omit<DraftSpec, 'dateKey'>> = {
  'Submission Inbox': { mode: 'queue', recordLabel: 'submission', focus: 'Triage newly received manuscripts', purpose: 'Review submission identity, arrival date and screening priority before assigning an editor.', primaryAction: 'Record submission', fields: [text('submissionRef', 'Submission reference'), text('manuscriptTitle', 'Manuscript title'), text('submitter', 'Submitted by'), day('receivedOn', 'Received on'), choice('priority', 'Screening priority', ['standard', 'urgent', 'on_hold']), note('intakeNotes', 'Intake notes')] },
  'Submit Manuscript': { mode: 'form', recordLabel: 'manuscript submission', focus: 'Prepare a manuscript submission', purpose: 'Capture the manuscript and contributor details for editorial intake.', primaryAction: 'Save submission draft', fields: [text('manuscriptTitle', 'Manuscript title'), text('author', 'Author / contributor'), text('genre', 'Genre / subject'), text('language', 'Language'), number('wordCount', 'Estimated word count', false), note('synopsis', 'Synopsis')] },
  'Manuscript Detail': { mode: 'detail', recordLabel: 'manuscript', focus: 'Inspect manuscript metadata', purpose: 'Keep a single manuscript reference, contributor and current editorial stage together.', primaryAction: 'Record manuscript detail', fields: [text('manuscriptRef', 'Manuscript reference'), text('manuscriptTitle', 'Title'), text('contributor', 'Contributor'), choice('currentStage', 'Current stage', ['intake', 'screening', 'review', 'editing', 'proof', 'ready']), number('wordCount', 'Word count', false), note('editorialSummary', 'Editorial summary')] },
  'Screening Queue': { mode: 'queue', recordLabel: 'screening item', focus: 'Prioritize eligibility screening', purpose: 'Record who is screening each submission, the due date and the eligibility finding.', primaryAction: 'Add screening item', fields: [text('manuscriptRef', 'Manuscript reference'), text('screener', 'Screening editor'), day('screeningDue', 'Screening due'), choice('eligibility', 'Eligibility finding', ['pending', 'eligible', 'needs_information', 'declined']), note('screeningReason', 'Screening reason')] },
  'Editorial Review': { mode: 'queue', recordLabel: 'editorial review', focus: 'Capture an editorial assessment', purpose: 'Separate a reviewer recommendation and assessment from the initial submission.', primaryAction: 'Record review', fields: [text('manuscriptRef', 'Manuscript reference'), text('reviewer', 'Reviewer'), day('reviewDate', 'Review date'), choice('recommendation', 'Recommendation', ['pending', 'accept', 'revise', 'reject']), note('assessment', 'Assessment')] },
  'Reviewer Assignment': { mode: 'form', recordLabel: 'reviewer assignment', focus: 'Plan reviewer responsibility', purpose: 'Record the reviewer, assignment date, deadline and declared conflict.', primaryAction: 'Save assignment draft', fields: [text('manuscriptRef', 'Manuscript reference'), text('reviewer', 'Assigned reviewer'), day('assignedOn', 'Assigned on'), day('dueOn', 'Review due'), choice('conflictDeclared', 'Conflict declared', ['no', 'yes', 'pending']), note('assignmentBrief', 'Review brief')] },
  'Editorial Task Board': { mode: 'board', recordLabel: 'editorial task', focus: 'Organize editorial tasks', purpose: 'Track task ownership and progress across editing, review and proof preparation.', primaryAction: 'Add task', fields: [text('manuscriptRef', 'Manuscript reference'), text('task', 'Task'), text('assignee', 'Assignee'), day('dueDate', 'Due date'), choice('progress', 'Progress', ['to_do', 'in_progress', 'blocked', 'done']), note('blocker', 'Blocker / handoff')] },
  'Editing & Proofreading Tracker': { mode: 'board', recordLabel: 'editing round', focus: 'Track edits and proof corrections', purpose: 'Follow each editing round, responsible editor and outstanding corrections.', primaryAction: 'Add editing round', fields: [text('manuscriptRef', 'Manuscript reference'), text('editingRound', 'Editing round'), text('editor', 'Editor / proofreader'), day('targetDate', 'Target date'), choice('progress', 'Progress', ['to_do', 'in_progress', 'blocked', 'done']), note('corrections', 'Corrections outstanding')] },
  'Version Comparison': { mode: 'comparison', recordLabel: 'version comparison', focus: 'Compare manuscript versions', purpose: 'Record the base and candidate versions and the differences that need review.', primaryAction: 'Record comparison', fields: [text('manuscriptRef', 'Manuscript reference'), text('baseVersion', 'Base version'), text('candidateVersion', 'Candidate version'), day('comparedOn', 'Compared on'), note('differences', 'Differences / decision')] },
  'Proof Approval': { mode: 'queue', recordLabel: 'proof decision', focus: 'Prepare a proof decision', purpose: 'Identify the proof version, decision owner and corrections before formal approval.', primaryAction: 'Record proof decision draft', fields: [text('manuscriptRef', 'Manuscript reference'), text('proofVersion', 'Proof version'), text('decisionOwner', 'Decision owner'), day('decisionDate', 'Decision date'), choice('decision', 'Proposed decision', ['pending', 'corrections', 'accepted']), note('corrections', 'Required corrections')] },
  'Editorial Calendar': { mode: 'calendar', recordLabel: 'editorial milestone', focus: 'Schedule editorial milestones', purpose: 'Plan reviews, proofs and handoffs against a manuscript and owner.', primaryAction: 'Add milestone', fields: [text('manuscriptRef', 'Manuscript reference'), text('milestone', 'Milestone'), day('scheduledDate', 'Scheduled date'), text('owner', 'Owner'), note('handoff', 'Handoff notes')] },
  'Rejection & Resubmission Register': { mode: 'history', recordLabel: 'resubmission', focus: 'Track rejection and resubmission', purpose: 'Record a decision reason and the conditions or deadline for a revised submission.', primaryAction: 'Record resubmission', fields: [text('manuscriptRef', 'Manuscript reference'), day('decisionDate', 'Decision date'), text('rejectionReason', 'Rejection reason'), day('resubmissionDue', 'Resubmission due', false), choice('state', 'Resubmission state', ['rejected', 'invited', 'received', 'closed']), note('conditions', 'Resubmission conditions')] },
  'Manuscript File Repository': { mode: 'list', recordLabel: 'file reference', focus: 'Index manuscript file versions', purpose: 'Store file references and version metadata; actual file upload requires a dedicated repository.', primaryAction: 'Add file reference', fields: [text('manuscriptRef', 'Manuscript reference'), text('fileName', 'File name'), text('version', 'Version'), choice('fileType', 'File type', ['manuscript', 'review', 'proof', 'attachment']), text('storageReference', 'Storage reference / location'), note('fileNotes', 'File notes')] },
  'Editorial SLA Report': { mode: 'report', recordLabel: 'SLA observation', focus: 'Review editorial turnaround', purpose: 'Compare receipt, target and completion dates for recorded editorial work.', primaryAction: 'Add SLA observation', fields: [text('manuscriptRef', 'Manuscript reference'), day('receivedOn', 'Received on'), day('targetDate', 'Target date'), day('completedOn', 'Completed on', false), note('delayReason', 'Delay reason')] },
  'Review Conflict Check': { mode: 'comparison', recordLabel: 'conflict check', focus: 'Assess reviewer conflicts', purpose: 'Document reviewer relationships and mitigation before an independent review.', primaryAction: 'Record conflict check', fields: [text('manuscriptRef', 'Manuscript reference'), text('reviewer', 'Reviewer'), text('relationship', 'Declared relationship'), choice('finding', 'Conflict finding', ['clear', 'potential', 'confirmed']), note('mitigation', 'Mitigation / reassignment')] },
  'Publication Readiness Checklist': { mode: 'setup', recordLabel: 'readiness check', focus: 'Prepare publication readiness', purpose: 'Review copyedit, proof, rights and identifier checks before release planning.', primaryAction: 'Save readiness check', fields: [text('manuscriptRef', 'Manuscript reference'), choice('copyedit', 'Copyedit', ['pending', 'complete']), choice('proof', 'Proof', ['pending', 'complete']), choice('rights', 'Rights clearance', ['pending', 'complete']), choice('identifier', 'ISBN / identifier', ['pending', 'complete']), day('releaseTarget', 'Target release date', false)] },
};

function modeFor(title: string): DraftMode {
  if (/Calendar|Schedule|Planner/.test(title)) return 'calendar';
  if (/Comparison|Variance|Conflict|Simulator|Preview/.test(title)) return 'comparison';
  if (/Board|Pipeline|Tracking|WIP|Operations/.test(title)) return 'board';
  if (/Export/.test(title)) return 'export';
  if (/History|Timeline|Audit Trail|Ledger|Log Explorer/.test(title)) return 'history';
  if (/Report|Analytics|Analysis|Performance|Forecast|Ageing|Dashboard|Statement|Profitability/.test(title)) return 'report';
  if (/Approval|Review|Queue|Inbox|Exception|Monitor|Reconciliation|Closeout/.test(title)) return 'queue';
  if (/Detail|Profile/.test(title)) return 'detail';
  if (/Setup|Settings|Rules|Mapping|Builder|Configuration|Checklist|Controls/.test(title)) return 'setup';
  if (/Directory/.test(title)) return 'directory';
  if (/Register/.test(title)) return 'register';
  if (/List/.test(title)) return 'list';
  if (/Create|Submit|Entry/.test(title)) return 'form';
  if (/Receipt|Issue|Allocation|Adjustment|Transfer|Settlement|Voucher|Payment|Order|Invoice|Claim|Return|Expense|Inspection/.test(title)) return 'transaction';
  return 'list';
}

function actionFor(mode: DraftMode, title: string) {
  if (mode === 'export') return 'Prepare export definition';
  if (mode === 'comparison') return 'Record comparison';
  if (mode === 'calendar') return 'Add schedule item';
  if (mode === 'board') return 'Add work item';
  if (mode === 'setup') return 'Save configuration draft';
  if (mode === 'directory') return 'Add directory entry';
  if (mode === 'register') return 'Add register entry';
  if (mode === 'transaction') return 'Prepare transaction draft';
  if (mode === 'report') return 'Add report input';
  if (mode === 'queue') return 'Add queue item';
  if (mode === 'form') return `Save ${title.toLowerCase()} draft`;
  return 'Add record';
}

export function draftSpecFor(screen: Screen): DraftSpec {
  const editorialSpec = screen.moduleSlug === 'manuscript-editorial' ? editorial[screen.title] : undefined;
  if (editorialSpec) return { ...editorialSpec, dateKey: editorialSpec.fields.find(field => field.type === 'date')?.key };
  const module = base[screen.moduleSlug] || base['administration-security'];
  const override = overrides.find(rule => rule.module === screen.moduleSlug && rule.match.test(screen.title));
  const title = screen.title;
  const mode = modeFor(title);
  const fields = [...(override?.fields || module.fields), ...(distinct[screen.title] ? [distinct[screen.title]] : [])];
  if (mode === 'board' && !fields.some(field => field.type === 'select')) fields.push(choice('progress', 'Work progress', ['to_do', 'in_progress', 'blocked', 'done']));
  if (mode === 'queue' && !fields.some(field => field.type === 'select')) fields.push(choice('queueState', 'Queue state', ['pending', 'in_review', 'resolved']));
  const dateKey = fields.find(field => field.type === 'date')?.key;
  const focus = override?.focus || module.focus;
  const required = fields.filter(field => field.required).slice(0, 2).map(field => field.label.toLowerCase()).join(' and ');
  return { mode, fields, recordLabel: title.toLowerCase(), focus: title, dateKey,
    purpose: `${focus}. Capture ${required} for this ${title.toLowerCase()} view.`,
    primaryAction: actionFor(mode, title) };
}
