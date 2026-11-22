-- Optional supplier GSTIN for GSTR-2 purchase register.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS gst_number text;

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS state text;

COMMENT ON COLUMN vendors.gst_number IS 'Supplier GSTIN (15 chars) used in GSTR-2 B2B reporting';
