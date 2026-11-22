const { ok, fail } = require("../../shared/response");
const { parseJsonBody } = require("../../shared/request");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { withTransaction } = require("../../shared/db");
const {
  clean,
  n,
  getAccountContextForUser,
  createInAppNotification
} = require("../orders/_common");

/**
 * POST /wholesaler-links/{id}/accept
 * Wholesaler accepts a PENDING match request.
 */
async function handler(event) {
  const auth = await requirePermission(event, "WHOLESALER_LINKS", "UPDATE");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "WHOLESALER") {
    return fail(403, "FORBIDDEN", "Only wholesaler can accept match requests.");
  }

  const id = clean(event?.pathParameters?.id);
  if (!id) return fail(400, "VALIDATION_ERROR", "link id is required.");
  const body = parseJsonBody(event);

  try {
    const link = await withTransaction(async (q) => {
      const up = await q(
        `
        UPDATE wholesaler_retailer_links
        SET status = 'ACTIVE',
            linked_at = COALESCE(linked_at, now()),
            accepted_by_user_id = $3,
            rejection_reason = NULL,
            rejected_at = NULL,
            rejected_by_user_id = NULL,
            credit_days = COALESCE($4, credit_days),
            credit_limit = COALESCE($5, credit_limit),
            discount_percent = COALESCE($6, discount_percent),
            updated_at = now()
        WHERE id = $1
          AND wholesaler_account_id = $2
          AND status = 'PENDING'
        RETURNING *
        `,
        [
          id,
          perms.accountId,
          actorId,
          body.credit_days ?? body.creditDays ?? null,
          body.credit_limit ?? body.creditLimit ?? null,
          body.discount_percent != null || body.discountPercent != null
            ? n(body.discount_percent ?? body.discountPercent)
            : null
        ]
      );
      const linkRow = up.rows?.[0];
      if (!linkRow) return null;

      const wholesalerName =
        clean(actor?.firm_name) || clean(actor?.full_name) || "Wholesaler";
      await createInAppNotification(
        q,
        linkRow.retailer_account_id,
        linkRow.retailer_account_id,
        "MATCH_ACCEPTED",
        "Match request accepted",
        `${wholesalerName} accepted your connection request.`,
        {
          link_id: linkRow.id,
          wholesaler_account_id: perms.accountId,
          action_path: "/wholesaler-links/accepted"
        }
      );
      return linkRow;
    });

    if (!link) return fail(404, "NOT_FOUND", "Pending match request not found.");
    return ok({ link }, { message: "Match request accepted." });
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to accept match request.");
  }
}

module.exports = { handler };
