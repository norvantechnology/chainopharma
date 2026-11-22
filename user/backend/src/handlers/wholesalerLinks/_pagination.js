/**
 * Shared pagination helpers for wholesaler-links list endpoints.
 * Query: page (default 1), limit (default 50, max 200)
 */
function parsePagination(qs = {}) {
  const page = Math.max(1, Number(qs.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(qs.limit) || 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginationMeta(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(Number(total || 0) / limit) || 1);
  return {
    pagination: {
      page,
      limit,
      total: Number(total || 0),
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1
    }
  };
}

module.exports = { parsePagination, paginationMeta };
