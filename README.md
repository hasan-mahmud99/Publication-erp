# Enterprise Publishing ERP (Frontend Showcase Edition)

An enterprise-grade, end-to-end **Publishing ERP** built with **Next.js 15 (App Router)** and **Tailwind CSS**.

This edition is specifically configured as a **standalone frontend showcase** for immediate **1-click deployment on [Vercel](https://vercel.com)**. All backend services, database logic, and API endpoints are decoupled and handled via an integrated, client-side & edge mock data engine pre-seeded with realistic publishing operations data.

---

## 🚀 Live Demo & 1-Click Vercel Deployment

Deploy your own instance directly to Vercel with zero configuration:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhasan-mahmud99%2FPublication-erp)

### Quick Start Locally
```bash
# Clone the repository
git clone https://github.com/hasan-mahmud99/Publication-erp.git
cd Publication-erp

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Access & Demonstration
- **Instant Access**: Open the app and click **"🚀 1-Click Demo Workspace Access (Owner)"** on the login page.
- **Default Account**: `admin@publishing-erp.local` (Role: `Owner` with full administrative rights across all 50+ screens).
- **Interactive State**: Any additions, edits, or status transitions (e.g. creating a BOM, approving payroll, adding fair booths, registering tax adjustments) update your local session in real-time.

---

## 📚 Core Business Modules & Pre-Seeded Capabilities

### 1. Publishing Catalog & Title Master
- Multi-format edition management (Paperback, Hardcover, E-Book, Audio).
- ISBN-13 validation and barcode tracking.
- Contributor agreements, royalty shares, and cover asset attachments.

### 2. Manuscript & Editorial Workflow
- Submission intake, editorial stage pipeline, and task assignments.
- **Editorial SLA Reports** tracking review turnaround times across editors.
- Proofreading and galley approval sign-offs.

### 3. Authors, Contracts & Royalty Accounting
- Tiered royalty slabs (e.g., 10% up to 2,000 copies, 15% thereafter).
- Royalty statement generation, advances deduction, and settlement registers.

### 4. Printing, Pre-Press & Production (BOM)
- Multi-component **Bill of Materials (BOM)**:
  - Inside pages: 70 GSM Cream Book Paper (Reams).
  - Cover: 300 GSM Art Card with Thermal Matte Lamination & Spot UV.
  - Binding: Section sewn and hot-melt perfect bound.
- Machine capacity scheduling (Heidelberg Speedmaster 4-Color Offset).
- Batch tracking, job tickets, and QA inspections.

### 5. Central Inventory & Multi-Warehouse Operations
- Real-time stock valuation across Central Warehouse (Banglabazar) and Regional Depots.
- Lot tracking, inter-warehouse stock transfers, and discrepancy registers.
- Slow-moving stock and inventory ageing reports.

### 6. Sales, Commercial Invoicing & Distribution
- Sales quotations, order conversion, and commercial tax invoices.
- Trade credit terms, credit limits, and consignment stock tracking.
- Customer directory with receivables ageing.

### 7. Book Fair & Event Operations (Amar Ekushey Boi Mela)
- Pavilion and stall setup (Main Pavilion 42, Children Corner, Double Stalls).
- Rapid Point of Sale (POS) sales counter with fair discount presets (25%).
- Event cash drawer daily reconciliation and P&L profitability statements.

### 8. Marketing, PR & E-Commerce Integration
- Omnichannel campaign management with promotional discount rules.
- Multi-channel e-commerce hub (Rokomari, Daraz, BoiBazar, Shopify).
- Automated order sync, payment verification, and HMAC webhook security.

### 9. HR & Statutory Payroll Management
- Complete employee directory with departmental hierarchy (Bangladeshi context).
- Biometric daily attendance and leave allowance tracking.
- Statutory payroll processing compliant with **NBR Income Tax Act 2023 (TDS Sec 86)** and Contributory Provident Fund (CPF).
- Provisional and finalized payslip PDF download preview.
- BEFTN bank batch disbursement plans and staff advance/expense claims.

### 10. Finance, Tax & General Ledger
- Multi-tier Chart of Accounts (COA) with automated voucher posting.
- NBR VAT Mushak 6.3 tax invoices, withholding certificates (Mushak 6.6), and current account registers.
- Automated balance sheet, income statement (P&L), and cash flow telemetry.

---

## 🛠️ Technology Stack
- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **UI & Icons**: [Lucide React](https://lucide.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Document Generation**: Client-side PDF / ExcelJS export capabilities
- **Architecture**: Zero-backend serverless architecture powered by integrated mock data engine

---

## 📄 License
Private & Proprietary. All rights reserved.
