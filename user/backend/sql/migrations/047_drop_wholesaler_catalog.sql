-- 047_drop_wholesaler_catalog.sql
-- Remove curated wholesaler_catalog layer; retailers order any wholesaler product by product_id.

DROP TRIGGER IF EXISTS trg_products_soft_delete_catalog_hide ON products;
DROP FUNCTION IF EXISTS sync_catalog_visibility_on_product_soft_delete();

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_catalog_id_fkey;
ALTER TABLE order_items DROP COLUMN IF EXISTS catalog_id;

DROP INDEX IF EXISTS idx_catalog_product;
DROP INDEX IF EXISTS idx_wholesaler_catalog_visible;
DROP TABLE IF EXISTS wholesaler_catalog CASCADE;

DELETE FROM user_role_permissions WHERE resource = 'CATALOG';
DELETE FROM permission_resources WHERE resource = 'CATALOG';
