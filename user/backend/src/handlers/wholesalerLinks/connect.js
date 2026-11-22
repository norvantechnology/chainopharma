const { created, fail } = require("../../shared/response");
const { parseJsonBody } = require("../../shared/request");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { query, withTransaction } = require("../../shared/db");
const {
  clean,
  getAccountContextForUser,
  getAccountProfile,
  createInAppNotification
} = require("../orders/_common");

/**
 * POST /wholesaler-links/connect
 * Retailer sends a match request to a wholesaler.
 * Re-request allowed when previous status was REJECTED (or no link exists).
 */
async function handler(event) {
  const auth = await requirePermission(event, "WHOLESALER_LINKS", "ADD");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "RETAILER") {
    return fail(403, "FORBIDDEN", "Only retailer can send a match request.");
  }

  const body = parseJsonBody(event);
  const wholesalerAccountId = clean(body.wholesaler_account_id || body.wholesalerAccountId);
  const requestMessage = clean(body.request_message || body.requestMessage || body.message) || null;
  if (!wholesalerAccountId) return fail(400, "VALIDATION_ERROR", "wholesaler_account_id is required.");
  if (wholesalerAccountId === perms.accountId) {
    return fail(400, "VALIDATION_ERROR", "Cannot send a match request to yourself.");
  }

  const wholesaler = await getAccountProfile(wholesalerAccountId);
  if (!wholesaler || String(wholesaler.role_code || "").toUpperCase() !== "WHOLESALER") {
    return fail(400, "VALIDATION_ERROR", "Invalid wholesaler account.");
  }

  const wholesalerUser = await query(
    `
    SELECT id, status, is_blocked, full_name, firm_name
    FROM app_users
    WHERE id = $1
    LIMIT 1
    `,
    [wholesalerAccountId]
  );
  const wRow = wholesalerUser.rows?.[0];
  if (!wRow || wRow.is_blocked || String(wRow.status || "").toUpperCase() !== "APPROVED") {
    return fail(400, "VALIDATION_ERROR", "Wholesaler is not active.");
  }

  try {
    const existing = await query(
      `
      SELECT id, status
      FROM wholesaler_retailer_links
      WHERE wholesaler_account_id = $1
        AND retailer_account_id = $2
      LIMIT 1
      `,
      [wholesalerAccountId, perms.accountId]
    );
    const row = existing.rows?.[0];
    const status = String(row?.status || "").toUpperCase();

    if (status === "PENDING") {
      return fail(409, "ALREADY_PENDING", "Match request already pending with this wholesaler.");
    }
    if (status === "ACTIVE") {
      return fail(409, "ALREADY_CONNECTED", "Already connected with this wholesaler.");
    }
    if (status === "BLOCKED") {
      return fail(403, "BLOCKED", "You are blocked by this wholesaler and cannot send a request.");
    }

    const link = await withTransaction(async (q) => {
      const ins = await q(
        `
        INSERT INTO wholesaler_retailer_links (
          wholesaler_account_id,
          retailer_account_id,
          status,
          request_message,
          requested_at,
          linked_at,
          rejection_reason,
          rejected_at,
          rejected_by_user_id,
          accepted_by_user_id
        )
        VALUES ($1, $2, 'PENDING', $3, now(), NULL, NULL, NULL, NULL, NULL)
        ON CONFLICT (wholesaler_account_id, retailer_account_id)
        DO UPDATE SET
          status = 'PENDING',
          request_message = EXCLUDED.request_message,
          requested_at = now(),
          linked_at = NULL,
          rejection_reason = NULL,
          rejected_at = NULL,
          rejected_by_user_id = NULL,
          accepted_by_user_id = NULL,
          updated_at = now()
        WHERE wholesaler_retailer_links.status = 'REJECTED'
        RETURNING *
        `,
        [wholesalerAccountId, perms.accountId, requestMessage]
      );
      const linkRow = ins.rows?.[0];
      if (!linkRow) {
        throw Object.assign(new Error("CONFLICT"), { code: "CONFLICT" });
      }

      const retailerName =
        clean(actor?.firm_name) || clean(actor?.full_name) || "A retailer";
      await createInAppNotification(
        q,
        wholesalerAccountId,
        wholesalerAccountId,
        "MATCH_REQUEST",
        "New match request",
        `${retailerName} sent you a connection request.`,
        {
          link_id: linkRow.id,
          retailer_account_id: perms.accountId,
          action_path: "/wholesaler-links/incoming"
        }
      );
      return linkRow;
    });

    return created({ link }, { message: "Match request sent." });
  } catch (e) {
    if (e && e.code === "CONFLICT") {
      return fail(409, "CONFLICT", "Unable to create match request for current link status.");
    }
    return fail(500, "INTERNAL_ERROR", "Failed to create match request.");
  }
}

module.exports = { handler };
