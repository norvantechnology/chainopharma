-- 045_wholesaler_match_requests.sql
-- Extend wholesaler_retailer_links for retailer→wholesaler match request flow.
-- Statuses: PENDING (request), ACTIVE (accepted), REJECTED (cancelled by wholesaler; retailer may re-request), BLOCKED (hard block).

ALTER TABLE wholesaler_retailer_links
  DROP CONSTRAINT IF EXISTS wholesaler_retailer_links_status_check;

ALTER TABLE wholesaler_retailer_links
  ADD CONSTRAINT wholesaler_retailer_links_status_check
  CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'BLOCKED'));

ALTER TABLE wholesaler_retailer_links
  ADD COLUMN IF NOT EXISTS request_message text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL;

UPDATE wholesaler_retailer_links
SET requested_at = COALESCE(requested_at, created_at)
WHERE status = 'PENDING' AND requested_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wsl_wholesaler_pending
  ON wholesaler_retailer_links(wholesaler_account_id, requested_at DESC)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_wsl_retailer_active
  ON wholesaler_retailer_links(retailer_account_id, linked_at DESC)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_wsl_retailer_status
  ON wholesaler_retailer_links(retailer_account_id, status, updated_at DESC);
