-- Add invoice_category column to distinguish between sales and purchase invoices
ALTER TABLE public.invoices 
ADD COLUMN invoice_category text NOT NULL DEFAULT 'sales';

-- Add check constraint for valid categories
ALTER TABLE public.invoices
ADD CONSTRAINT invoices_category_check CHECK (invoice_category IN ('sales', 'purchase'));

-- Add index for efficient filtering by category
CREATE INDEX idx_invoices_category ON public.invoices(invoice_category);

-- Add supplier GSTIN column for purchase invoices
ALTER TABLE public.invoices
ADD COLUMN supplier_gstin text;

-- Add supplier name column for purchase invoices
ALTER TABLE public.invoices
ADD COLUMN supplier_name text;