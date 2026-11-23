import { notFound } from 'next/navigation';
import { ErpShell } from '@/components/erp-shell';
import { DraftWorkflowScreen } from '@/components/draft-workflow-screen';
import { BookMasterScreen } from '@/components/book-master-screen';
import { CategoryScreen } from '@/components/category-screen';
import { CatalogInsightsScreen } from '@/components/catalog-insights-screen';
import { CatalogImportScreen } from '@/components/catalog-import-screen';
import { CatalogPeopleScreen } from '@/components/catalog-people-screen';
import { EditionScreen } from '@/components/edition-screen';
import { CatalogReviewScreen } from '@/components/catalog-review-screen';
import { DigitalFormatScreen } from '@/components/digital-format-screen';
import { CatalogIdentifiersScreen } from '@/components/catalog-identifiers-screen';
import { CatalogScreen } from '@/components/catalog-screen';
import { FinanceScreen } from '@/components/finance-screen';
import { FinanceDashboardScreen } from '@/components/finance-dashboard-screen';
import { ChartOfAccountsScreen } from '@/components/chart-of-accounts-screen';
import { JournalGeneralLedgerScreen } from '@/components/journal-general-ledger-screen';
import { AccountsReceivableScreen } from '@/components/accounts-receivable-screen';
import { AccountsPayableScreen } from '@/components/accounts-payable-screen';
import { CashBankScreen } from '@/components/cash-bank-screen';
import { ExpenseRegisterScreen } from '@/components/expense-register-screen';
import { FinancialStatementsScreen } from '@/components/financial-statements-screen';
import { FinanceCostCentreScreen } from '@/components/finance-cost-centre-screen';
import { FinanceAuditScreen } from '@/components/finance-audit-screen';
import { TaxRuleScreen } from '@/components/tax-rule-screen';
import { TaxClassificationScreen } from '@/components/tax-classification-screen';
import { EcommerceChannelScreen } from '@/components/ecommerce-channel-screen';
import { EcommerceOrderDetailScreen } from '@/components/ecommerce-order-detail-screen';
import { EcommercePaymentScreen } from '@/components/ecommerce-payment-screen';
import { EcommerceOperationsScreen } from '@/components/ecommerce-operations-screen';
import { EcommerceDigitalReadinessScreen } from '@/components/ecommerce-digital-readiness-screen';
import { EcommerceReportScreen } from '@/components/ecommerce-report-screen';
import { InventoryScreen } from '@/components/inventory-screen';
import { AdminScreen } from '@/components/admin-screen';
import { AdminAuditScreen } from '@/components/admin-audit-screen';
import { AdminHealthScreen } from '@/components/admin-health-screen';
import { AdminSessionScreen } from '@/components/admin-session-screen';
import { CrmScreen } from '@/components/crm-screen';
import { CustomerDirectoryScreen } from '@/components/customer-directory-screen';
import { OpportunityPipelineScreen } from '@/components/opportunity-pipeline-screen';
import { ComplaintsDisputesScreen } from '@/components/complaints-disputes-screen';
import { CrmProfitabilityScreen } from '@/components/crm-profitability-screen';
import { SalesQuotationScreen } from '@/components/sales-quotation-screen';
import { SalesOrderScreen } from '@/components/sales-order-screen';
import { SalesConsignmentScreen } from '@/components/sales-consignment-screen';
import { SalesInvoiceScreen } from '@/components/sales-invoice-screen';
import { SalesReturnEligibilityScreen } from '@/components/sales-return-eligibility-screen';
import { ReturnsRequestScreen } from '@/components/returns-request-screen';
import { ReturnsAnalyticsScreen } from '@/components/returns-analytics-screen';
import { ReturnsInspectionScreen } from '@/components/returns-inspection-screen';
import { ReturnsVendorClaimsScreen } from '@/components/returns-vendor-claims-screen';
import { ReturnsDispositionScreen } from '@/components/returns-disposition-screen';
import { ReturnsFinancialHoldScreen } from '@/components/returns-financial-hold-screen';
import { ReturnsCreditNoteScreen } from '@/components/returns-credit-note-screen';
import { ReturnsSettlementScreen } from '@/components/returns-settlement-screen';
import { SalesCustomerHistoryScreen } from '@/components/sales-customer-history-screen';
import { SalesDispatchScreen } from '@/components/sales-dispatch-screen';
import { SalesDiscountScreen } from '@/components/sales-discount-screen';
import { SalesDeliveryScreen } from '@/components/sales-delivery-screen';
import { DashboardScreen } from '@/components/dashboard-screen';
import { HrScreen } from '@/components/hr-screen';
import { ReportSalesScreen } from '@/components/report-sales-screen';
import { ReportFinanceScreen } from '@/components/report-finance-screen';
import { ReportInventoryScreen } from '@/components/report-inventory-screen';
import { ReportCenterScreen } from '@/components/report-center-screen';
import { ReportAccessAuditScreen } from '@/components/report-access-audit-screen';
import { ReportReconciliationScreen } from '@/components/report-reconciliation-screen';
import { ReportPublisherScreen } from '@/components/report-publisher-screen';
import { ReportEditionScreen } from '@/components/report-edition-screen';
import { ReportOperationalScreen } from '@/components/report-operational-screen';
import { ReportProductionCostScreen } from '@/components/report-production-cost-screen';
import { ReportRoyaltyLiabilityScreen } from '@/components/report-royalty-liability-screen';
import { ReportCustomerSupplierAgeingScreen } from '@/components/report-customer-supplier-ageing-screen';
import { ReportFairProfitabilityScreen } from '@/components/report-fair-profitability-screen';
import { ReportExportJobsScreen } from '@/components/report-export-jobs-screen';
import { ReportSchedulesScreen } from '@/components/report-schedules-screen';
import { WorkflowInboxScreen } from '@/components/workflow-inbox-screen';
import { WorkflowApprovalLimitsScreen } from '@/components/workflow-approval-limits-screen';
import { WorkflowDeadlineScreen } from '@/components/workflow-deadline-screen';
import { WorkflowRuleBuilderScreen } from '@/components/workflow-rule-builder-screen';
import { WorkflowDelegationScreen } from '@/components/workflow-delegation-screen';
import { WorkflowExceptionScreen } from '@/components/workflow-exception-screen';
import { NotificationCenterScreen } from '@/components/notification-center-screen';
import { NotificationTaskInboxScreen } from '@/components/notification-task-inbox-screen';
import { NotificationDeliveryHistoryScreen } from '@/components/notification-delivery-history-screen';
import { NotificationPreferencesScreen } from '@/components/notification-preferences-screen';
import { NotificationJobMonitorScreen } from '@/components/notification-job-monitor-screen';
import { NotificationAlertRulesScreen } from '@/components/notification-alert-rules-screen';
import { NotificationTemplatesScreen } from '@/components/notification-templates-screen';
import { NotificationDeliverySettingsScreen } from '@/components/notification-delivery-settings-screen';
import { EditorialScreen } from '@/components/editorial-screen';
import { RightsAuthorsScreen } from '@/components/rights-authors-screen';
import { RightsContractsScreen } from '@/components/rights-contracts-screen';
import { RightsGrantsScreen } from '@/components/rights-grants-screen';
import { RightsRoyaltyRulesScreen } from '@/components/rights-royalty-rules-screen';
import { RightsSplitsScreen } from '@/components/rights-splits-screen';
import { RightsAdvancesScreen } from '@/components/rights-advances-screen';
import { RightsRoyaltyPreviewScreen } from '@/components/rights-royalty-preview-screen';
import { RightsRoyaltyStatementsScreen } from '@/components/rights-royalty-statements-screen';
import { ProductionSpecScreen } from '@/components/production-spec-screen';
import { ProductionBomScreen } from '@/components/production-bom-screen';
import { ProductionOrdersScreen } from '@/components/production-orders-screen';
import { ProductionPlanningBoardScreen } from '@/components/production-planning-board-screen';
import { PrintOrderListScreen } from '@/components/print-order-list-screen';
import { PrintOrderDetailScreen } from '@/components/print-order-detail-screen';
import { MaterialIssueScreen } from '@/components/material-issue-screen';
import { WipTrackingScreen } from '@/components/wip-tracking-screen';
import { QcInspectionScreen } from '@/components/qc-inspection-screen';
import { ProductionReceiptScreen } from '@/components/production-receipt-screen';
import { ProductionExecutionScreen } from '@/components/production-execution-screen';
import { ProductionAnalysisScreen } from '@/components/production-analysis-screen';
import { ProductionBatchScreen } from '@/components/production-batch-screen';
import { SupplierDirectoryScreen } from '@/components/supplier-directory-screen';
import { SupplierLedgerScreen } from '@/components/supplier-ledger-screen';
import { SupplierOrderScreen } from '@/components/supplier-order-screen';
import { SupplierBillScreen } from '@/components/supplier-bill-screen';
import { SupplierPaymentScreen } from '@/components/supplier-payment-screen';
import { SupplierPerformanceScreen } from '@/components/supplier-performance-screen';
import { ProcurementSupplierScreen } from '@/components/procurement-supplier-screen';
import { ProcurementRequisitionScreen } from '@/components/procurement-requisition-screen';
import { ProcurementRfqScreen } from '@/components/procurement-rfq-screen';
import { ProcurementPurchaseOrderScreen } from '@/components/procurement-purchase-order-screen';
import { ProcurementReceiptScreen } from '@/components/procurement-receipt-screen';
import { ProcurementBillScreen } from '@/components/procurement-bill-screen';
import { ProcurementInsightsScreen } from '@/components/procurement-insights-screen';
import { ProcurementPaymentScreen } from '@/components/procurement-payment-screen';
import { ProcurementReturnScreen } from '@/components/procurement-return-screen';
import { FairEventScreen } from '@/components/fair-event-screen';
import { ReleaseCalendarScreen } from '@/components/release-calendar-screen';
import { CampaignListScreen } from '@/components/campaign-list-screen';
import { MarketingCampaignScreen } from '@/components/marketing-campaign-screen';
import { MarketingLaunchPlannerScreen } from '@/components/marketing-launch-planner-screen';
import { PromotionDiscountRulesScreen } from '@/components/promotion-discount-rules-screen';
import { AuthorContributorScreen } from '@/components/author-contributor-screen';
import { PriceListScreen } from '@/components/price-list-screen';
import { IdentifierValidationQueueScreen } from '@/components/identifier-validation-queue-screen';
import { PublisherImprintScreen } from '@/components/publisher-imprint-screen';
import { CatalogExportScreen } from '@/components/catalog-export-screen';
import { TaxConfigurationScreen } from '@/components/tax-configuration-screen';
import { TaxTransactionRegisterScreen } from '@/components/tax-transaction-register-screen';
import { TaxDocumentRegisterScreen } from '@/components/tax-document-register-screen';
import { TaxReconciliationScreen } from '@/components/tax-reconciliation-screen';
import { TaxAdjustmentScreen } from '@/components/tax-adjustment-screen';
import { TaxReportExportScreen } from '@/components/tax-report-export-screen';
import { TaxComplianceScreen } from '@/components/tax-compliance-screen';
import { dashboardImplementedScreens, catalogImplementedScreens, financeImplementedScreens, inventoryImplementedScreens, adminImplementedScreens, crmImplementedScreens, hrDedicatedScreens, editorialDedicatedScreens, rightsAuthorScreens, rightsContractScreens, rightsGrantsScreens, rightsRoyaltyRulesScreens, rightsSplitsScreens, rightsAdvancesScreens, rightsRoyaltyPreviewScreens, rightsRoyaltyStatementsScreens, productionOrderScreens, productionExecutionScreens, productionAnalysisScreens } from '@/lib/implemented-screens';
import { findScreen } from '@/lib/screens';

const bookMasterScreens = new Set(['Book Catalog List', 'Create Book', 'Edit Book', 'Book Detail & Timeline']);
const catalogInsightScreens = new Set(['Publication Calendar', 'Catalog Change History', 'Book Metadata Completeness']);
const catalogImportScreens = new Set(['Bulk Import Preview', 'Import Job History']);
const catalogPeopleScreens = new Set(['Publisher & Imprint Management']);
const editionScreens = new Set(['Edition List', 'Create/Edit Edition', 'Edition Detail']);
const catalogReviewScreens = new Set(['Discontinued Titles', 'Catalog Duplicate Review']);

export default async function RegisteredScreen({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const screen = findScreen('/' + slug.join('/'));
  if (!screen) return notFound();
  return <ErpShell>
    {screen.moduleSlug === 'dashboard-workspace' && dashboardImplementedScreens.has(screen.title) ? <DashboardScreen screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && bookMasterScreens.has(screen.title) ? <BookMasterScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && screen.title === 'Category & Subject Management' ? <CategoryScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && screen.title === 'Catalog Export' ? <CatalogExportScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && catalogInsightScreens.has(screen.title) ? <CatalogInsightsScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && catalogImportScreens.has(screen.title) ? <CatalogImportScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && screen.title === 'Author/Contributor Assignment' ? <AuthorContributorScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && catalogPeopleScreens.has(screen.title) ? <PublisherImprintScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && editionScreens.has(screen.title) ? <EditionScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && catalogReviewScreens.has(screen.title) ? <CatalogReviewScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && screen.title === 'Digital Format Register' ? <DigitalFormatScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && screen.title === 'Price List Management' ? <PriceListScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && screen.title === 'Identifier Validation Queue' ? <IdentifierValidationQueueScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && screen.title === 'ISBN & Identifier Register' ? <CatalogIdentifiersScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'publishing-catalog' && catalogImplementedScreens.has(screen.title) ? <CatalogScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Finance Dashboard' ? <FinanceDashboardScreen />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Chart of Accounts' ? <ChartOfAccountsScreen />
      : screen.moduleSlug === 'finance-accounting' && ['Journal Voucher List', 'Create Journal Voucher', 'Journal Entry Detail'].includes(screen.title) ? <JournalGeneralLedgerScreen initialTab="vouchers" />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'General Ledger' ? <JournalGeneralLedgerScreen initialTab="ledger" />
      : screen.moduleSlug === 'finance-accounting' && ['Accounts Receivable', 'Receipt Voucher', 'Unapplied Receipts & Payments'].includes(screen.title) ? <AccountsReceivableScreen initialTab="customers" />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Customer Ageing' ? <AccountsReceivableScreen initialTab="ageing" />
      : screen.moduleSlug === 'finance-accounting' && ['Accounts Payable', 'Payment Voucher'].includes(screen.title) ? <AccountsPayableScreen initialTab="suppliers" />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Supplier Ageing' ? <AccountsPayableScreen initialTab="ageing" />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Cash & Bank Accounts' ? <CashBankScreen initialTab="portfolio" />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Bank Reconciliation' ? <CashBankScreen initialTab="reconciliation" />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Expense Register' ? <ExpenseRegisterScreen initialTab="vouchers" />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Fixed Assets' ? <ExpenseRegisterScreen initialTab="fixed-assets" />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Profit & Loss / Balance Sheet / Cash Flow' ? <FinancialStatementsScreen />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Cost Centre Setup' ? <FinanceCostCentreScreen />
      : screen.moduleSlug === 'finance-accounting' && screen.title === 'Financial Audit Trail' ? <FinanceAuditScreen />
      : screen.moduleSlug === 'finance-accounting' && financeImplementedScreens.has(screen.title) ? <FinanceScreen screen={screen} />
      : screen.moduleSlug === 'ecommerce-digital' && ['Channel Integration Settings', 'Online Order Inbox', 'Webhook Delivery Monitor', 'Channel Sync Exceptions'].includes(screen.title) ? <EcommerceChannelScreen title={screen.title} />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Online Order Detail' ? <EcommerceOrderDetailScreen />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Payment Reconciliation' ? <EcommercePaymentScreen />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Fulfilment Queue' ? <EcommerceOperationsScreen kind="fulfilment" />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Refund & Cancellation Queue' ? <EcommerceOperationsScreen kind="refunds" />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Digital Product/Access Management' ? <EcommerceDigitalReadinessScreen />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Digital Sales & Royalty Report' ? <EcommerceReportScreen />
      : screen.moduleSlug === 'inventory-warehouse' && inventoryImplementedScreens.has(screen.title) ? <InventoryScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'administration-security' && screen.title === 'Audit Log Explorer' ? <AdminAuditScreen />
      : screen.moduleSlug === 'administration-security' && screen.title === 'System Health & Job Monitoring' ? <AdminHealthScreen />
      : screen.moduleSlug === 'administration-security' && screen.title === 'Session & MFA Policy' ? <AdminSessionScreen />
      : screen.moduleSlug === 'administration-security' && adminImplementedScreens.has(screen.title) ? <AdminScreen screen={screen} />
      : screen.moduleSlug === 'crm-customers' && screen.title === 'Opportunity Pipeline' ? <OpportunityPipelineScreen screen={screen} />
      : screen.moduleSlug === 'crm-customers' && ['Customer Profile', 'CRM Dashboard', 'Customer Contacts & Addresses', 'Customer Segmentation', 'Customer Activity Timeline', 'Territory & Sales Assignment', 'Customer Duplicate Review', 'Customer Profitability'].includes(screen.title) ? <CustomerDirectoryScreen screen={screen} />
      : screen.moduleSlug === 'crm-customers' && ['Complaints & Disputes'].includes(screen.title) ? <ComplaintsDisputesScreen screen={screen} />
      : screen.moduleSlug === 'sales-distribution' && screen.title === 'Customer/Distributor Directory' ? <CustomerDirectoryScreen screen={screen} />
      : screen.moduleSlug === 'sales-distribution' && ['Sales Quotation List', 'Create Quotation'].includes(screen.title) ? <SalesQuotationScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'sales-distribution' && ['Sales Order List', 'Create Sales Order', 'Sales Order Detail'].includes(screen.title) ? <SalesOrderScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'sales-distribution' && screen.title === 'Consignment Dispatch & Settlement' ? <SalesConsignmentScreen />
      : screen.moduleSlug === 'sales-distribution' && screen.title === 'Sales Invoice List' ? <SalesInvoiceScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'sales-distribution' && screen.title === 'Sales Return Eligibility Preview' ? <SalesReturnEligibilityScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'returns-claims' && screen.title === 'Create Return Request' ? <SalesReturnEligibilityScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'returns-claims' && ['Return Request List', 'Return Approval Queue'].includes(screen.title) ? <ReturnsRequestScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'returns-claims' && screen.title === 'Return Analytics' ? <ReturnsAnalyticsScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'returns-claims' && screen.title === 'Return Inspection' ? <ReturnsInspectionScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'returns-claims' && screen.title === 'Supplier/Printer Claim Register' ? <ReturnsVendorClaimsScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'returns-claims' && screen.title === 'Return Disposition' ? <ReturnsDispositionScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'returns-claims' && screen.title === 'Sales Credit Note' ? <ReturnsCreditNoteScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'returns-claims' && screen.title === 'Refund & Replacement Register' ? <ReturnsSettlementScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'sales-distribution' && screen.title === 'Customer Order History' ? <SalesCustomerHistoryScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'sales-distribution' && screen.title === 'Delivery/Dispatch Register' ? <SalesDispatchScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'sales-distribution' && screen.title === 'Price & Discount Override Approval' ? <SalesDiscountScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'sales-distribution' && screen.title === 'Delivery Tracking' ? <SalesDeliveryScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'hr-payroll' && hrDedicatedScreens.has(screen.title) ? <HrScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'manuscript-editorial' && editorialDedicatedScreens.has(screen.title) ? <EditorialScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'authors-contracts-rights' && rightsAuthorScreens.has(screen.title) ? <RightsAuthorsScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'authors-contracts-rights' && rightsContractScreens.has(screen.title) ? <RightsContractsScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'authors-contracts-rights' && rightsGrantsScreens.has(screen.title) ? <RightsGrantsScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'authors-contracts-rights' && rightsRoyaltyRulesScreens.has(screen.title) ? <RightsRoyaltyRulesScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'authors-contracts-rights' && rightsSplitsScreens.has(screen.title) ? <RightsSplitsScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'authors-contracts-rights' && rightsAdvancesScreens.has(screen.title) ? <RightsAdvancesScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'authors-contracts-rights' && rightsRoyaltyPreviewScreens.has(screen.title) ? <RightsRoyaltyPreviewScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'authors-contracts-rights' && rightsRoyaltyStatementsScreens.has(screen.title) ? <RightsRoyaltyStatementsScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && screen.title === 'Print Specification Sheet' ? <ProductionSpecScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && screen.title === 'BOM & Material Requirement' ? <ProductionBomScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && screen.title === 'Production Planning Board' ? <ProductionPlanningBoardScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && screen.title === 'Print Order List' ? <PrintOrderListScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && screen.title === 'Material Issue' ? <MaterialIssueScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && ['WIP Tracking', 'Production Operations'].includes(screen.title) ? <WipTrackingScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && ['Quality Inspection', 'Wastage & Rejection Register'].includes(screen.title) ? <QcInspectionScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && ['Production Receipt', 'Finished Goods Acceptance'].includes(screen.title) ? <ProductionReceiptScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && screen.title === 'Print Order Detail' ? <PrintOrderDetailScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && productionOrderScreens.has(screen.title) ? <ProductionOrdersScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && productionExecutionScreens.has(screen.title) ? <ProductionExecutionScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && productionAnalysisScreens.has(screen.title) ? <ProductionAnalysisScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'printing-production' && screen.title === 'Production Batch History' ? <ProductionBatchScreen key={screen.id} screen={screen} />
      : (screen.moduleSlug === 'suppliers' || screen.moduleSlug === 'procurement-suppliers') && screen.title === 'Supplier Directory' ? <SupplierDirectoryScreen key={screen.id} screen={screen} />
      : (screen.moduleSlug === 'suppliers' || screen.moduleSlug === 'procurement-suppliers') && screen.title === 'Supplier Profile & Ledger' ? <SupplierLedgerScreen key={screen.id} screen={screen} />
      : (screen.moduleSlug === 'suppliers' || screen.moduleSlug === 'procurement-suppliers') && screen.title === 'Supplier Material Orders' ? <SupplierOrderScreen key={screen.id} screen={screen} />
      : (screen.moduleSlug === 'suppliers' || screen.moduleSlug === 'procurement-suppliers') && screen.title === 'Supplier Bill Register' ? <SupplierBillScreen key={screen.id} screen={screen} />
      : (screen.moduleSlug === 'suppliers' || screen.moduleSlug === 'procurement-suppliers') && ['Supplier Advance Register', 'Supplier Payment Allocation'].includes(screen.title) ? <SupplierPaymentScreen key={screen.id} screen={screen} />
      : (screen.moduleSlug === 'suppliers' || screen.moduleSlug === 'procurement-suppliers') && screen.title === 'Supplier Performance' ? <SupplierPerformanceScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Sales & Returns Reports' ? <ReportSalesScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Financial Statements' ? <ReportFinanceScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Inventory Reports' ? <ReportInventoryScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Report Center' ? <ReportCenterScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Report Access Audit' ? <ReportAccessAuditScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Data Quality & Reconciliation Report' ? <ReportReconciliationScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Publisher/Imprint Performance' ? <ReportPublisherScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Edition Lifecycle Analytics' ? <ReportEditionScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Operational KPI Dashboard' ? <ReportOperationalScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Production Cost Reports' ? <ReportProductionCostScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Royalty Liability Reports' ? <ReportRoyaltyLiabilityScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Customer/Supplier Ageing Reports' ? <ReportCustomerSupplierAgeingScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Book/Fair Profitability Reports' ? <ReportFairProfitabilityScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Export Job History' ? <ReportExportJobsScreen />
      : screen.moduleSlug === 'reports-analytics' && screen.title === 'Scheduled Reports' ? <ReportSchedulesScreen />
      : screen.moduleSlug === 'workflow-approvals' && screen.title === 'Approval Inbox' ? <WorkflowInboxScreen mode="inbox" />
      : screen.moduleSlug === 'workflow-approvals' && screen.title === 'Workflow History' ? <WorkflowInboxScreen mode="history" />
      : screen.moduleSlug === 'workflow-approvals' && screen.title === 'Approval Matrix' ? <WorkflowApprovalLimitsScreen mode="matrix" />
      : screen.moduleSlug === 'workflow-approvals' && screen.title === 'Approval Limit Simulator' ? <WorkflowApprovalLimitsScreen mode="simulator" />
      : screen.moduleSlug === 'workflow-approvals' && screen.title === 'Overdue & Escalation Report' ? <WorkflowDeadlineScreen />
      : screen.moduleSlug === 'workflow-approvals' && screen.title === 'Approval Rule Builder' ? <WorkflowRuleBuilderScreen />
      : screen.moduleSlug === 'workflow-approvals' && screen.title === 'Delegation Setup' ? <WorkflowDelegationScreen />
      : screen.moduleSlug === 'workflow-approvals' && screen.title === 'Workflow Exception Queue' ? <WorkflowExceptionScreen />
      : screen.moduleSlug === 'notifications-tasks' && screen.title === 'Notification Center' ? <NotificationCenterScreen />
      : screen.moduleSlug === 'notifications-tasks' && screen.title === 'Task Inbox' ? <NotificationTaskInboxScreen />
      : screen.moduleSlug === 'notifications-tasks' && screen.title === 'Notification Delivery History' ? <NotificationDeliveryHistoryScreen />
      : screen.moduleSlug === 'notifications-tasks' && screen.title === 'User Notification Preferences' ? <NotificationPreferencesScreen />
      : screen.moduleSlug === 'notifications-tasks' && screen.title === 'Scheduled Job Monitor' ? <NotificationJobMonitorScreen />
      : screen.moduleSlug === 'notifications-tasks' && screen.title === 'Alert Rules' ? <NotificationAlertRulesScreen />
      : screen.moduleSlug === 'notifications-tasks' && screen.title === 'Notification Templates' ? <NotificationTemplatesScreen />
      : screen.moduleSlug === 'notifications-tasks' && screen.title === 'Alert Delivery Preferences' ? <NotificationDeliverySettingsScreen />
      : screen.moduleSlug === 'book-fair-events' && ['Fair/Event List', 'Create/Edit Fair', 'Fair Setup & Booth', 'Fair Stock Allocation', 'Fair Sales Entry', 'Post-Fair Stock Reconciliation', 'Fair Reports', 'Fair Profitability Report'].includes(screen.title) ? <FairEventScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'marketing-promotions' && ['Release Calendar', 'Event/Launch Planner'].includes(screen.title) ? <ReleaseCalendarScreen screen={screen} />
      : screen.moduleSlug === 'marketing-promotions' && ['Campaign List', 'Create Campaign', 'Campaign Budget Approval', 'Campaign Performance'].includes(screen.title) ? <CampaignListScreen screen={screen} />
      : screen.moduleSlug === 'marketing-promotions' && ['Promotion & Discount Rules', 'Promotion Conflict Review'].includes(screen.title) ? <PromotionDiscountRulesScreen key={screen.id} screen={screen} />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Tax Configuration' ? <TaxConfigurationScreen />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Effective-Dated Tax Rules' ? <TaxRuleScreen title={screen.title} />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Tax Classification Mapping' ? <TaxClassificationScreen />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Tax Transaction Register' ? <TaxTransactionRegisterScreen />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Tax Document Register' ? <TaxDocumentRegisterScreen />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Input/Output Tax Reconciliation' ? <TaxReconciliationScreen />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Credit/Debit Note Tax Review' ? <TaxAdjustmentScreen />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Tax Report Export' ? <TaxReportExportScreen />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Tax Rule Change History' ? <TaxRuleScreen title={screen.title} />
      : screen.moduleSlug === 'vat-tax' && screen.title === 'Tax Compliance Checklist' ? <TaxComplianceScreen />
      : screen.moduleSlug === 'ecommerce-digital' && ['Channel Integration Settings', 'Online Order Inbox', 'Webhook Delivery Monitor', 'Channel Sync Exceptions'].includes(screen.title) ? <EcommerceChannelScreen title={screen.title} />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Online Order Detail' ? <EcommerceOrderDetailScreen />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Payment Reconciliation' ? <EcommercePaymentScreen />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Fulfilment Queue' ? <EcommerceOperationsScreen kind="fulfilment" />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Refund & Cancellation Queue' ? <EcommerceOperationsScreen kind="refunds" />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Digital Product/Access Management' ? <EcommerceDigitalReadinessScreen />
      : screen.moduleSlug === 'ecommerce-digital' && screen.title === 'Digital Sales & Royalty Report' ? <EcommerceReportScreen />
      : screen.moduleSlug === 'hr-payroll' ? <HrScreen key={screen.id} screen={screen} />
      : <DraftWorkflowScreen key={screen.id} screen={screen} />}
  </ErpShell>;
}
