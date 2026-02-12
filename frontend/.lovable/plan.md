

## GST Compliance Automation Tool - Implementation Plan

### Overview
A professional, corporate-styled React dashboard for Indian businesses and Chartered Accountants to automate GST compliance. Users can upload sales data from Excel files, validate invoices, and generate GSTR-1 and GSTR-3B reports.

---

### Phase 1: Foundation & Core Features (Initial Build)

#### 1. Design System & Layout
- **Corporate Blue Theme**: Professional color palette with blues, whites, and subtle grays
- **App Shell**: Clean header with logo, navigation, and user dropdown (profile menu)
- **Sidebar Navigation**: Easy access to Upload, Preview, GSTR-1, GSTR-3B, and Downloads
- **Responsive Cards**: Content organized in clean, shadowed card components

#### 2. Authentication System
- **Login/Signup Page**: Email and password authentication using Supabase Auth
- **User Profiles**: Store name, company name, and GSTIN
- **Protected Routes**: Redirect unauthenticated users to login

#### 3. Upload & Column Mapping Page
- **Drag-and-Drop Upload**: Modern file upload zone for Excel files (.xlsx, .xls)
- **Column Mapper**: Interface to map Excel columns to required GST fields:
  - Invoice Number, Date, Customer Name, GSTIN
  - Taxable Value, CGST, SGST, IGST, Total
  - Place of Supply, HSN Code, etc.
- **Save Mappings**: Remember column mappings for future uploads

#### 4. Invoice Preview & Validation Page
- **Data Table**: Display all parsed invoices in a clean, sortable table
- **Status Badges**: Visual indicators per invoice
  - ✅ Passed - Valid invoice
  - ⚠️ Warning - Minor issues
  - ❌ Failed - Validation errors
- **Inline Error Explanations**: Hover or click to see specific validation issues
  - Invalid GSTIN format
  - Missing place of supply
  - Tax calculation mismatches
- **Filters**: Filter by status, date range, or customer

#### 5. Database Structure
- **User Profiles**: Name, company, GSTIN, settings
- **Upload Sessions**: Track each upload batch with timestamp
- **Invoices Table**: Store cleaned, validated invoice data
- **Validation Results**: Store error/warning logs per invoice

---

### Phase 2: GST Report Generation (Next Iteration)

#### 6. GSTR-1 Tables Page
- Auto-generate all GSTR-1 sections from validated data:
  - **B2B**: Business-to-business invoices
  - **B2CL**: Large B2C invoices (>₹2.5 lakh)
  - **B2CS**: Small B2C invoices (state-wise summary)
  - **Exports**: Export invoices with/without payment
  - **CDN/R**: Credit/Debit notes
  - **HSN Summary**: HSN-wise summary of outward supplies
- Each section in its own tab with proper formatting

#### 7. GSTR-3B Summary Page
- Auto-calculated summary including:
  - Outward taxable supplies
  - Inward supplies (reverse charge)
  - Tax liability breakdown (CGST, SGST, IGST)
  - Input tax credit eligible
- Visual summary cards with key figures

#### 8. Download Section
- Export options:
  - **Excel Format**: Download individual GSTR-1 tables or complete workbook
  - **JSON Format**: Government portal compatible format
- Download history tracking

---

### Technical Approach
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui components
- **Backend**: Supabase (Lovable Cloud) for auth, database, and storage
- **Excel Parsing**: Client-side processing using SheetJS library
- **Validation Engine**: Built-in GSTIN validation, tax calculation checks, and format verification

---

### What You'll Get in Phase 1
1. Working login/signup with user profiles
2. Beautiful file upload interface with column mapping
3. Invoice data table with real-time validation
4. Professional dashboard layout ready for Phase 2 features

