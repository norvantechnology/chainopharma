const { ok, fail } = require("../../shared/response");
const { parseJsonBody } = require("../../shared/request");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { withTransaction } = require("../../shared/db");
const {
  clean,
  getAccountContextForUser,
  createInAppNotification
} = require("../orders/_common");

/**
 * POST /wholesaler-links/{id}/reject
 * Wholesaler rejects/cancels a PENDING match request.
 * Retailer may send a new request afterwards.
 */
async function handler(event) {
  const auth = await requirePermission(event, "WHOLESALER_LINKS", "UPDATE");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "WHOLESALER") {
    return fail(403, "FORBIDDEN", "Only wholesaler can reject match requests.");
  }

  const id = clean(event?.pathParameters?.id);
  if (!id) return fail(400, "VALIDATION_ERROR", "link id is required.");
  const body = parseJsonBody(event);
  const rejectionReason = clean(body.rejection_reason || body.rejectionReason || body.reason) || null;

  try {
    const link = await withTransaction(async (q) => {
      const up = await q(
        `
        UPDATE wholesaler_retailer_links
        SET status = 'REJECTED',
            rejection_reason = $3,
            rejected_at = now(),
            rejected_by_user_id = $4,
            linked_at = NULL,
            updated_at = now()
        WHERE id = $1
          AND wholesaler_account_id = $2
          AND status = 'PENDING'
        RETURNING *
        `,
        [id, perms.accountId, rejectionReason, actorId]
      );
      const linkRow = up.rows?.[0];
      if (!linkRow) return null;

      const wholesalerName =
        clean(actor?.firm_name) || clean(actor?.full_name) || "Wholesaler";
      await createInAppNotification(
        q,
        linkRow.retailer_account_id,
        linkRow.retailer_account_id,
        "MATCH_REJECTED",
        "Match request rejected",
        `${wholesalerName} rejected your connection request.`,
        {
          link_id: linkRow.id,
          wholesaler_account_id: perms.accountId,
          rejection_reason: rejectionReason
        }
      );
      return linkRow;
    });

    if (!link) return fail(404, "NOT_FOUND", "Pending match request not found.");
    return ok({ link }, { message: "Match request rejected." });
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to reject match request.");
  }
}

module.exports = { handler };
