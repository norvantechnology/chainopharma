-- 046_marketplace_rbac_resources.sql
-- Dedicated RBAC resources for B2B marketplace + backfill missing role grants.

------------------------------------------------------------------------
-- 1) Marketplace permission resources
------------------------------------------------------------------------
INSERT INTO permission_resources(resource, display_name, description, sort_order) VALUES
  ('ORDERS',           'Orders',           'B2B marketplace purchase orders between retailers and wholesalers', 110),
  ('CATALOG',          'Catalog',          'Wholesaler catalog listing and visibility for marketplace orders', 111),
  ('WHOLESALER_LINKS', 'Wholesaler Links', 'Retailer–wholesaler match / connection requests', 112)
ON CONFLICT (resource) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description  = EXCLUDED.description,
    sort_order   = EXCLUDED.sort_order;

-- Clarify legacy PO resource (kept for compatibility; marketplace uses ORDERS).
UPDATE permission_resources
SET display_name = COALESCE(NULLIF(display_name, ''), 'Purchase Orders'),
    description = COALESCE(
      NULLIF(description, ''),
      'Optional purchase-order workflow (legacy). Marketplace orders use ORDERS.'
    )
WHERE resource = 'PURCHASE_ORDERS'
  AND (display_name IS NULL OR description IS NULL OR description ILIKE '%optional%');

------------------------------------------------------------------------
-- 2) Backfill ANY missing resource onto existing custom roles (view-only)
------------------------------------------------------------------------
INSERT INTO user_role_permissions (role_id, resource, can_add, can_view, can_update, can_delete)
SELECT r.id, pr.resource, false, true, false, false
FROM user_roles r
CROSS JOIN permission_resources pr
WHERE NOT EXISTS (
  SELECT 1
  FROM user_role_permissions p
  WHERE p.role_id = r.id
    AND p.resource = pr.resource
);

------------------------------------------------------------------------
-- 3) Copy existing PURCHASE_ORDERS grants → ORDERS + WHOLESALER_LINKS
------------------------------------------------------------------------
INSERT INTO user_role_permissions (role_id, resource, can_add, can_view, can_update, can_delete)
SELECT role_id, 'ORDERS', can_add, can_view, can_update, can_delete
FROM user_role_permissions
WHERE resource = 'PURCHASE_ORDERS'
ON CONFLICT (role_id, resource) DO UPDATE
SET
  can_add    = user_role_permissions.can_add    OR EXCLUDED.can_add,
  can_view   = user_role_permissions.can_view   OR EXCLUDED.can_view,
  can_update = user_role_permissions.can_update OR EXCLUDED.can_update,
  can_delete = user_role_permissions.can_delete OR EXCLUDED.can_delete;

INSERT INTO user_role_permissions (role_id, resource, can_add, can_view, can_update, can_delete)
SELECT role_id, 'WHOLESALER_LINKS', can_add, can_view, can_update, can_delete
FROM user_role_permissions
WHERE resource = 'PURCHASE_ORDERS'
ON CONFLICT (role_id, resource) DO UPDATE
SET
  can_add    = user_role_permissions.can_add    OR EXCLUDED.can_add,
  can_view   = user_role_permissions.can_view   OR EXCLUDED.can_view,
  can_update = user_role_permissions.can_update OR EXCLUDED.can_update,
  can_delete = user_role_permissions.can_delete OR EXCLUDED.can_delete;

------------------------------------------------------------------------
-- 4) Catalog grants: prefer PRODUCT_BATCHES, else PURCHASE_ORDERS
------------------------------------------------------------------------
INSERT INTO user_role_permissions (role_id, resource, can_add, can_view, can_update, can_delete)
SELECT role_id, 'CATALOG', can_add, can_view, can_update, can_delete
FROM user_role_permissions
WHERE resource = 'PRODUCT_BATCHES'
ON CONFLICT (role_id, resource) DO UPDATE
SET
  can_add    = user_role_permissions.can_add    OR EXCLUDED.can_add,
  can_view   = user_role_permissions.can_view   OR EXCLUDED.can_view,
  can_update = user_role_permissions.can_update OR EXCLUDED.can_update,
  can_delete = user_role_permissions.can_delete OR EXCLUDED.can_delete;

INSERT INTO user_role_permissions (role_id, resource, can_add, can_view, can_update, can_delete)
SELECT role_id, 'CATALOG', can_add, can_view, can_update, can_delete
FROM user_role_permissions
WHERE resource = 'PURCHASE_ORDERS'
ON CONFLICT (role_id, resource) DO UPDATE
SET
  can_add    = user_role_permissions.can_add    OR EXCLUDED.can_add,
  can_view   = user_role_permissions.can_view   OR EXCLUDED.can_view,
  can_update = user_role_permissions.can_update OR EXCLUDED.can_update,
  can_delete = user_role_permissions.can_delete OR EXCLUDED.can_delete;
