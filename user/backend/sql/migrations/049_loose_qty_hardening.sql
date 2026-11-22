-- Loose / tablet (tabs) sale hardening
-- 1) Allow strip qty = 0 when selling tablets only (loose_qty > 0)
-- 2) Prefer enable_loose_sale on for retailer accounts
-- 3) Backfill packing_units from product packing text when still defaulted

DO $$
DECLARE
  cname text;
BEGIN
  -- Drop any CHECK that forces sales_invoice_items.qty > 0
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'sales_invoice_items'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%qty%'
      AND pg_get_constraintdef(con.oid) ILIKE '%>% 0%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%loose_qty%'
  LOOP
    EXECUTE format('ALTER TABLE sales_invoice_items DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

ALTER TABLE sales_invoice_items
  ALTER COLUMN qty SET DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_invoice_items_qty_nonneg'
  ) THEN
    ALTER TABLE sales_invoice_items
      ADD CONSTRAINT sales_invoice_items_qty_nonneg CHECK (qty >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_invoice_items_qty_or_loose'
  ) THEN
    ALTER TABLE sales_invoice_items
      ADD CONSTRAINT sales_invoice_items_qty_or_loose
      CHECK (qty > 0 OR COALESCE(loose_qty, 0) > 0 OR COALESCE(free_qty, 0) > 0);
  END IF;
END $$;

-- Sales returns: allow returning tablets from an invoice that sold loose qty
ALTER TABLE sales_return_items
  ADD COLUMN IF NOT EXISTS return_loose_qty numeric(12,3) NOT NULL DEFAULT 0;

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'sales_return_items'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%return_qty%'
      AND pg_get_constraintdef(con.oid) ILIKE '%>% 0%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%loose%'
  LOOP
    EXECUTE format('ALTER TABLE sales_return_items DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_return_items_return_qty_nonneg'
  ) THEN
    ALTER TABLE sales_return_items
      ADD CONSTRAINT sales_return_items_return_qty_nonneg CHECK (return_qty >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_return_items_return_loose_qty_nonneg'
  ) THEN
    ALTER TABLE sales_return_items
      ADD CONSTRAINT sales_return_items_return_loose_qty_nonneg CHECK (return_loose_qty >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_return_items_qty_or_loose'
  ) THEN
    ALTER TABLE sales_return_items
      ADD CONSTRAINT sales_return_items_qty_or_loose
      CHECK (return_qty > 0 OR COALESCE(return_loose_qty, 0) > 0 OR COALESCE(return_free_qty, 0) > 0);
  END IF;
END $$;

-- Default: loose/tablet sales enabled for accounts that have settings row
UPDATE account_settings
SET enable_loose_sale = TRUE
WHERE enable_loose_sale IS DISTINCT FROM TRUE;

-- Backfill packing_units from packing string when still at default 10 and packing has digits
-- Prefer last integer in packing (e.g. "10x10" / "1×15" → 10 / 15 tabs per strip)
UPDATE product_batches pb
SET packing_units = GREATEST(
  1,
  LEAST(
    10000,
    COALESCE(
      NULLIF(
        (regexp_match(COALESCE(p.packing, pb.packing, ''), '(\d+)\s*$'))[1]::int,
        NULL
      ),
      pb.packing_units,
      10
    )
  )
),
updated_at = now()
FROM products p
WHERE p.id = pb.product_id
  AND p.account_id = pb.account_id
  AND COALESCE(pb.packing_units, 10) = 10
  AND COALESCE(p.packing, pb.packing, '') ~ '\d';
