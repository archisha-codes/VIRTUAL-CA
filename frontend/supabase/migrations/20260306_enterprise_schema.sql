-- Enterprise GST Schema Tables
-- Migration: Create additional tables for GST compliance platform

-- Create sales_invoices table
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  customer_name TEXT,
  customer_gstin TEXT NOT NULL,
  place_of_supply TEXT,
  hsn_code TEXT,
  taxable_value DECIMAL(15, 2) DEFAULT 0,
  cgst_rate DECIMAL(5, 2) DEFAULT 0,
  cgst_amount DECIMAL(15, 2) DEFAULT 0,
  sgst_rate DECIMAL(5, 2) DEFAULT 0,
  sgst_amount DECIMAL(15, 2) DEFAULT 0,
  igst_rate DECIMAL(5, 2) DEFAULT 0,
  igst_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  invoice_type TEXT DEFAULT 'B2B' CHECK (invoice_type IN ('B2B', 'B2CL', 'B2CS', 'EXPORT', 'CDN', 'CDR')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_invoices table
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  supplier_name TEXT,
  supplier_gstin TEXT NOT NULL,
  place_of_supply TEXT,
  hsn_code TEXT,
  taxable_value DECIMAL(15, 2) DEFAULT 0,
  cgst_rate DECIMAL(5, 2) DEFAULT 0,
  cgst_amount DECIMAL(15, 2) DEFAULT 0,
  sgst_rate DECIMAL(5, 2) DEFAULT 0,
  sgst_amount DECIMAL(15, 2) DEFAULT 0,
  igst_rate DECIMAL(5, 2) DEFAULT 0,
  igst_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  invoice_type TEXT DEFAULT 'B2B' CHECK (invoice_type IN ('B2B', 'B2CL', 'B2CS', 'IMPORT')),
  itc_eligible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gstr1_returns table
CREATE TABLE IF NOT EXISTS public.gstr1_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_period TEXT NOT NULL,
  filing_status TEXT DEFAULT 'draft' CHECK (filing_status IN ('draft', 'filed', 'pending')),
  filed_date TIMESTAMP WITH TIME ZONE,
  b2b_invoices INTEGER DEFAULT 0,
  b2cl_invoices INTEGER DEFAULT 0,
  b2cs_invoices INTEGER DEFAULT 0,
  export_invoices INTEGER DEFAULT 0,
  cdn_invoices INTEGER DEFAULT 0,
  total_taxable_value DECIMAL(15, 2) DEFAULT 0,
  total_igst DECIMAL(15, 2) DEFAULT 0,
  total_cgst DECIMAL(15, 2) DEFAULT 0,
  total_sgst DECIMAL(15, 2) DEFAULT 0,
  total_cess DECIMAL(15, 2) DEFAULT 0,
  json_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gstr3b_returns table
CREATE TABLE IF NOT EXISTS public.gstr3b_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_period TEXT NOT NULL,
  filing_status TEXT DEFAULT 'draft' CHECK (filing_status IN ('draft', 'filed', 'pending')),
  filed_date TIMESTAMP WITH TIME ZONE,
  total_outward_supply DECIMAL(15, 2) DEFAULT 0,
  total_tax_liability DECIMAL(15, 2) DEFAULT 0,
  itc_available DECIMAL(15, 2) DEFAULT 0,
  itc_claimed DECIMAL(15, 2) DEFAULT 0,
  tax_paid DECIMAL(15, 2) DEFAULT 0,
  interest_paid DECIMAL(15, 2) DEFAULT 0,
  late_fee_paid DECIMAL(15, 2) DEFAULT 0,
  json_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gstr2b_data table
CREATE TABLE IF NOT EXISTS public.gstr2b_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_period TEXT NOT NULL,
  supplier_gstin TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE,
  taxable_value DECIMAL(15, 2) DEFAULT 0,
  igst_amount DECIMAL(15, 2) DEFAULT 0,
  cgst_amount DECIMAL(15, 2) DEFAULT 0,
  sgst_amount DECIMAL(15, 2) DEFAULT 0,
  itc_available DECIMAL(15, 2) DEFAULT 0,
  filing_status TEXT DEFAULT 'matched' CHECK (filing_status IN ('matched', 'missing', 'mismatch', 'not_found')),
  json_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reconciliation_results table
CREATE TABLE IF NOT EXISTS public.reconciliation_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_period TEXT NOT NULL,
  reconciliation_type TEXT NOT NULL CHECK (reconciliation_type IN ('purchase_gstr2b', 'sales_gstr1_gstr3b')),
  total_records INTEGER DEFAULT 0,
  matched_records INTEGER DEFAULT 0,
  missing_records INTEGER DEFAULT 0,
  mismatch_records INTEGER DEFAULT 0,
  tax_difference DECIMAL(15, 2) DEFAULT 0,
  json_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gstr1_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gstr3b_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gstr2b_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sales_invoices
CREATE POLICY "Users can view their own sales invoices"
ON public.sales_invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales invoices"
ON public.sales_invoices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales invoices"
ON public.sales_invoices FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales invoices"
ON public.sales_invoices FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for purchase_invoices
CREATE POLICY "Users can view their own purchase invoices"
ON public.purchase_invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchase invoices"
ON public.purchase_invoices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchase invoices"
ON public.purchase_invoices FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own purchase invoices"
ON public.purchase_invoices FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for gstr1_returns
CREATE POLICY "Users can view their own GSTR1 returns"
ON public.gstr1_returns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own GSTR1 returns"
ON public.gstr1_returns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own GSTR1 returns"
ON public.gstr1_returns FOR UPDATE
USING (auth.uid() = user_id);

-- Create RLS policies for gstr3b_returns
CREATE POLICY "Users can view their own GSTR3B returns"
ON public.gstr3b_returns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own GSTR3B returns"
ON public.gstr3b_returns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own GSTR3B returns"
ON public.gstr3b_returns FOR UPDATE
USING (auth.uid() = user_id);

-- Create RLS policies for gstr2b_data
CREATE POLICY "Users can view their own GSTR2B data"
ON public.gstr2b_data FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own GSTR2B data"
ON public.gstr2b_data FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for reconciliation_results
CREATE POLICY "Users can view their own reconciliation results"
ON public.reconciliation_results FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reconciliation results"
ON public.reconciliation_results FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for audit_logs
CREATE POLICY "Users can view their own audit logs"
ON public.audit_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_sales_invoices_user ON public.sales_invoices(user_id);
CREATE INDEX idx_sales_invoices_gstin ON public.sales_invoices(customer_gstin);
CREATE INDEX idx_sales_invoices_date ON public.sales_invoices(invoice_date);
CREATE INDEX idx_sales_invoices_type ON public.sales_invoices(invoice_type);

CREATE INDEX idx_purchase_invoices_user ON public.purchase_invoices(user_id);
CREATE INDEX idx_purchase_invoices_gstin ON public.purchase_invoices(supplier_gstin);
CREATE INDEX idx_purchase_invoices_date ON public.purchase_invoices(invoice_date);

CREATE INDEX idx_gstr1_returns_user ON public.gstr1_returns(user_id);
CREATE INDEX idx_gstr1_returns_period ON public.gstr1_returns(return_period);

CREATE INDEX idx_gstr3b_returns_user ON public.gstr3b_returns(user_id);
CREATE INDEX idx_gstr3b_returns_period ON public.gstr3b_returns(return_period);

CREATE INDEX idx_gstr2b_data_user ON public.gstr2b_data(user_id);
CREATE INDEX idx_gstr2b_data_period ON public.gstr2b_data(return_period);
CREATE INDEX idx_gstr2b_data_gstin ON public.gstr2b_data(supplier_gstin);

CREATE INDEX idx_reconciliation_results_user ON public.reconciliation_results(user_id);
CREATE INDEX idx_reconciliation_results_period ON public.reconciliation_results(return_period);

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
