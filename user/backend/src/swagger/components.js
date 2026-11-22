/**
 * Shared OpenAPI components for Chaino Pharma User Backend.
 */
module.exports = {
  securitySchemes: {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT access token from /auth/login or /auth/otp/verify. Header: Authorization: Bearer <token>"
    }
  },
  schemas: {
    ApiSuccess: {
      type: "object",
      properties: {
        ok: { type: "boolean", example: true },
        data: { description: "Endpoint-specific payload" },
        meta: { nullable: true, description: "Pagination or extra metadata" },
        error: { nullable: true, example: null }
      }
    },
    ApiError: {
      type: "object",
      properties: {
        ok: { type: "boolean", example: false },
        data: { nullable: true, example: null },
        meta: { nullable: true, example: null },
        error: {
          type: "object",
          properties: {
            code: { type: "string", example: "VALIDATION_ERROR" },
            message: { type: "string" },
            subMessage: { type: "string", nullable: true },
            details: { nullable: true }
          }
        }
      }
    },
    Tokens: {
      type: "object",
      properties: {
        accessToken: { type: "string" },
        refreshToken: { type: "string" },
        accessTokenExpiresIn: { type: "integer", example: 7200, description: "Access token TTL in seconds (2 hours)" },
        refreshTokenExpiresIn: { type: "integer", example: 86400 }
      }
    },
    User: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        role: { type: "string", enum: ["WHOLESALER", "RETAILER"] },
        full_name: { type: "string" },
        email: { type: "string", format: "email" },
        phone_country_code: { type: "string", example: "+91" },
        phone_number: { type: "string" },
        email_verified: { type: "boolean" },
        status: { type: "string", example: "APPROVED" },
        is_blocked: { type: "boolean" },
        account_id: { type: "string", format: "uuid", nullable: true },
        firm_name: { type: "string", nullable: true },
        gst_number: { type: "string", nullable: true }
      }
    },
    IdsBody: {
      type: "object",
      required: ["ids"],
      properties: {
        ids: { type: "array", items: { type: "string", format: "uuid" }, minItems: 1 }
      }
    },
    PaginationQuery: {
      type: "object",
      properties: {
        page: { type: "integer", minimum: 1, example: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100, example: 20 },
        search: { type: "string" },
        q: { type: "string", description: "Search query alias" }
      }
    }
  }
};
