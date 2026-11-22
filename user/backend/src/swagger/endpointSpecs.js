/**
 * Per-endpoint OpenAPI enrichment keyed by "METHOD /path".
 * Paths use OpenAPI style: /resource/{id}
 */
module.exports = {
  // ── Health ──────────────────────────────────────────────────────────────
  "GET /hello": {
    tags: ["Health"],
    summary: "Health check",
    security: [],
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            example: {
              ok: true,
              data: { panel: "user", message: "ok", app: "medico-user-backend-local", stage: "local" },
              meta: null,
              error: null
            }
          }
        }
      }
    }
  },

  // ── Auth ────────────────────────────────────────────────────────────────
  "POST /auth/signup": {
    tags: ["Auth"],
    summary: "Sign up (WHOLESALER or RETAILER)",
    security: [],
    body: {
      required: ["role", "fullName", "email", "countryCode", "phoneNumber", "password"],
      properties: {
        role: { type: "string", enum: ["WHOLESALER", "RETAILER"] },
        fullName: { type: "string", example: "Rahul Sharma" },
        email: { type: "string", format: "email", example: "rahul@example.com" },
        countryCode: { type: "string", example: "+91" },
        phoneNumber: { type: "string", example: "9876543210" },
        password: { type: "string", format: "password", minLength: 8, example: "Password@123" }
      }
    }
  },
  "POST /auth/login": {
    tags: ["Auth"],
    summary: "Login",
    security: [],
    body: {
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email", example: "rahul@example.com" },
        password: { type: "string", format: "password", example: "Password@123" },
        role: { type: "string", enum: ["WHOLESALER", "RETAILER"] },
        rememberMe: { type: "boolean", example: false }
      }
    }
  },
  "POST /auth/refresh": {
    tags: ["Auth"],
    summary: "Refresh access token",
    security: [],
    body: {
      required: ["email", "refreshToken"],
      properties: {
        email: { type: "string", format: "email" },
        refreshToken: { type: "string" }
      }
    }
  },
  "POST /auth/logout": {
    tags: ["Auth"],
    summary: "Logout (invalidate refresh token)",
    security: [],
    body: {
      required: ["email", "refreshToken"],
      properties: {
        email: { type: "string", format: "email" },
        refreshToken: { type: "string" }
      }
    }
  },
  "POST /auth/password/change": {
    tags: ["Auth"],
    summary: "Change password (authenticated)",
    body: {
      required: ["currentPassword", "newPassword"],
      properties: {
        currentPassword: { type: "string", format: "password" },
        newPassword: { type: "string", format: "password", minLength: 8 }
      }
    }
  },
  "POST /auth/otp/request": {
    tags: ["Auth"],
    summary: "Request email verification OTP",
    security: [],
    body: {
      required: ["email"],
      properties: {
        email: { type: "string", format: "email" },
        role: { type: "string", enum: ["WHOLESALER", "RETAILER"] }
      }
    }
  },
  "POST /auth/otp/verify": {
    tags: ["Auth"],
    summary: "Verify email OTP and get tokens",
    security: [],
    body: {
      required: ["email", "otp"],
      properties: {
        email: { type: "string", format: "email" },
        otp: { type: "string", example: "123456" },
        rememberMe: { type: "boolean" }
      }
    }
  },
  "POST /auth/password/forgot/request": {
    tags: ["Auth"],
    summary: "Request forgot-password OTP",
    security: [],
    body: {
      required: ["email"],
      properties: { email: { type: "string", format: "email" } }
    }
  },
  "POST /auth/password/forgot/resend": {
    tags: ["Auth"],
    summary: "Resend forgot-password OTP",
    security: [],
    body: {
      required: ["email"],
      properties: { email: { type: "string", format: "email" } }
    }
  },
  "POST /auth/password/forgot/reset": {
    tags: ["Auth"],
    summary: "Reset password with OTP",
    security: [],
    body: {
      required: ["email", "otp", "newPassword"],
      properties: {
        email: { type: "string", format: "email" },
        otp: { type: "string" },
        newPassword: { type: "string", format: "password", minLength: 8 }
      }
    }
  },

  // ── User / Registration ─────────────────────────────────────────────────
  "GET /me": {
    tags: ["User"],
    summary: "Get current user profile"
  },
  "POST /me/update": {
    tags: ["User"],
    summary: "Update current user profile",
    body: {
      properties: {
        fullName: { type: "string" },
        countryCode: { type: "string", example: "+91" },
        phoneNumber: { type: "string" },
        firmName: { type: "string" },
        address: { type: "string" },
        pinCode: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        gstNumber: { type: "string" },
        drugLicense1Number: { type: "string" },
        drugLicense2Number: { type: "string" },
        gstCertificateUrl: { type: "string" },
        drugLicense1Url: { type: "string" },
        drugLicense2Url: { type: "string" }
      }
    }
  },
  "POST /registration": {
    tags: ["Registration"],
    summary: "Full firm registration (signup + documents)",
    security: [],
    body: {
      required: ["role", "fullName", "email", "countryCode", "phoneNumber", "password", "firmName"],
      properties: {
        role: { type: "string", enum: ["WHOLESALER", "RETAILER"] },
        fullName: { type: "string" },
        email: { type: "string", format: "email" },
        countryCode: { type: "string", example: "+91" },
        phoneNumber: { type: "string" },
        password: { type: "string", format: "password", minLength: 8 },
        firmName: { type: "string" },
        address: { type: "string" },
        pinCode: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        gstNumber: { type: "string" },
        drugLicense1Number: { type: "string" },
        drugLicense2Number: { type: "string" },
        gstCertificateUrl: { type: "string" },
        drugLicense1Url: { type: "string" },
        drugLicense2Url: { type: "string" }
      }
    }
  },

  // ── Access / Roles / Users ──────────────────────────────────────────────
  "GET /access/me": { tags: ["Access"], summary: "Current user permissions" },
  "GET /access/permission-resources": { tags: ["Access"], summary: "Permission resource catalog" },
  "GET /access/roles": { tags: ["Access"], summary: "List custom roles" },
  "POST /access/roles": {
    tags: ["Access"],
    summary: "Create custom role",
    body: { required: ["name"], properties: { name: { type: "string", example: "Store Manager" } } }
  },
  "POST /access/roles/{id}": { tags: ["Access"], summary: "Delete custom role" },
  "POST /access/roles/{id}/update": {
    tags: ["Access"],
    summary: "Update role name and permissions",
    body: {
      properties: {
        name: { type: "string" },
        permissions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              resource: { type: "string", example: "PRODUCTS" },
              actions: { type: "array", items: { type: "string", enum: ["VIEW", "ADD", "UPDATE", "DELETE"] } }
            }
          }
        }
      }
    }
  },
  "POST /access/bulk-delete-roles": {
    tags: ["Access"],
    summary: "Bulk delete roles",
    bodyRef: "IdsBody"
  },
  "GET /access/users": { tags: ["Access"], summary: "List account users" },
  "POST /access/users": {
    tags: ["Access"],
    summary: "Create account user",
    body: {
      required: ["fullName", "email", "phoneCountryCode", "phoneNumber", "customRoleId"],
      properties: {
        fullName: { type: "string" },
        email: { type: "string", format: "email" },
        phoneCountryCode: { type: "string", example: "+91" },
        phoneNumber: { type: "string" },
        customRoleId: { type: "string", format: "uuid" }
      }
    }
  },
  "POST /access/users/{id}/update": {
    tags: ["Access"],
    summary: "Update account user",
    body: {
      properties: {
        fullName: { type: "string" },
        phoneCountryCode: { type: "string" },
        phoneNumber: { type: "string" }
      }
    }
  },
  "POST /access/users/{id}/role": {
    tags: ["Access"],
    summary: "Assign role to user",
    body: { required: ["roleId"], properties: { roleId: { type: "string", format: "uuid" } } }
  },
  "POST /access/users/{id}/delete": { tags: ["Access"], summary: "Delete account user" },
  "POST /access/bulk-delete-users": {
    tags: ["Access"],
    summary: "Bulk delete users",
    bodyRef: "IdsBody"
  },

  // ── Vendors ─────────────────────────────────────────────────────────────
  "GET /vendors": {
    tags: ["Vendors"],
    summary: "List vendors",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      search: { type: "string" },
      q: { type: "string" }
    }
  },
  "POST /vendors": {
    tags: ["Vendors"],
    summary: "Create vendor",
    body: {
      required: ["name"],
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        contactPerson: { type: "string" },
        phone: { type: "string" },
        email: { type: "string", format: "email" },
        address: { type: "string" },
        creditDays: { type: "integer", example: 30 },
        vendorType: { type: "string" },
        mfgCompanyId: { type: "string", format: "uuid" },
        gstNumber: { type: "string" },
        notes: { type: "string" }
      }
    }
  },
  "POST /vendors/{id}/update": {
    tags: ["Vendors"],
    summary: "Update vendor",
    body: {
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        contactPerson: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        creditDays: { type: "integer" },
        vendorType: { type: "string" },
        mfgCompanyId: { type: "string", format: "uuid" },
        gstNumber: { type: "string" },
        notes: { type: "string" }
      }
    }
  },
  "POST /vendors/{id}/delete": { tags: ["Vendors"], summary: "Delete vendor" },
  "POST /vendors/bulk-delete": { tags: ["Vendors"], summary: "Bulk delete vendors", bodyRef: "IdsBody" },
  "GET /vendors/{id}/ledger": { tags: ["Vendors"], summary: "Vendor ledger" },

  // ── Divisions ───────────────────────────────────────────────────────────
  "GET /divisions": {
    tags: ["Divisions"],
    summary: "List divisions",
    query: {
      search: { type: "string" },
      mfg_company_id: { type: "string", format: "uuid" },
      is_active: { type: "boolean" },
      page: { type: "integer" },
      limit: { type: "integer" }
    }
  },
  "POST /divisions": {
    tags: ["Divisions"],
    summary: "Create division",
    body: {
      required: ["name", "mfgCompanyId"],
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        mfgCompanyId: { type: "string", format: "uuid" },
        contactPerson: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        creditDays: { type: "integer" },
        isActive: { type: "boolean" }
      }
    }
  },
  "GET /divisions/{id}": { tags: ["Divisions"], summary: "Get division" },
  "POST /divisions/{id}/update": {
    tags: ["Divisions"],
    summary: "Update division",
    body: {
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        mfgCompanyId: { type: "string", format: "uuid" },
        contactPerson: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        creditDays: { type: "integer" },
        isActive: { type: "boolean" }
      }
    }
  },
  "POST /divisions/{id}/delete": { tags: ["Divisions"], summary: "Delete division" },
  "GET /divisions/{id}/outstanding": { tags: ["Divisions"], summary: "Division outstanding" },

  // ── Division payments ───────────────────────────────────────────────────
  "GET /division-payments": {
    tags: ["Division Payments"],
    summary: "List division payments",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      division_id: { type: "string", format: "uuid" },
      invoice_id: { type: "string", format: "uuid" },
      payment_mode: { type: "string" }
    }
  },
  "POST /division-payments": {
    tags: ["Division Payments"],
    summary: "Create division payment",
    body: {
      required: ["divisionId", "amount", "paymentDate"],
      properties: {
        divisionId: { type: "string", format: "uuid" },
        invoiceId: { type: "string", format: "uuid" },
        amount: { type: "number", example: 1500.5 },
        paymentDate: { type: "string", format: "date" },
        paymentMode: { type: "string", example: "NEFT" },
        referenceNumber: { type: "string" },
        notes: { type: "string" }
      }
    }
  },
  "POST /division-payments/bulk-settle": {
    tags: ["Division Payments"],
    summary: "Bulk settle division invoices",
    body: {
      required: ["paymentDate"],
      properties: {
        invoiceIds: { type: "array", items: { type: "string", format: "uuid" } },
        ids: { type: "array", items: { type: "string", format: "uuid" } },
        paymentDate: { type: "string", format: "date" },
        paymentMode: { type: "string" },
        referenceNumber: { type: "string" },
        notes: { type: "string" }
      }
    }
  },

  // ── Mfg companies ───────────────────────────────────────────────────────
  "GET /mfg-companies": {
    tags: ["Mfg Companies"],
    summary: "List manufacturing companies",
    query: { q: { type: "string" }, page: { type: "integer" }, limit: { type: "integer" } }
  },
  "POST /mfg-companies": {
    tags: ["Mfg Companies"],
    summary: "Create manufacturing company",
    body: {
      required: ["name"],
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        creditDays: { type: "integer" },
        creditLimit: { type: "number" },
        lockSales: { type: "boolean" },
        lockPurchase: { type: "boolean" },
        notes: { type: "string" }
      }
    }
  },
  "POST /mfg-companies/{id}/update": {
    tags: ["Mfg Companies"],
    summary: "Update manufacturing company",
    body: {
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        creditDays: { type: "integer" },
        creditLimit: { type: "number" },
        lockSales: { type: "boolean" },
        lockPurchase: { type: "boolean" },
        notes: { type: "string" }
      }
    }
  },
  "POST /mfg-companies/{id}/delete": { tags: ["Mfg Companies"], summary: "Delete manufacturing company" },
  "POST /mfg-companies/bulk-delete": {
    tags: ["Mfg Companies"],
    summary: "Bulk delete manufacturing companies",
    bodyRef: "IdsBody"
  },
  "GET /mfg-companies/check-unique": {
    tags: ["Mfg Companies"],
    summary: "Check code/name uniqueness",
    query: {
      code: { type: "string" },
      name: { type: "string" },
      exclude_id: { type: "string", format: "uuid" }
    }
  },
  "GET /mfg-companies/{id}/policy-impact": {
    tags: ["Mfg Companies"],
    summary: "Get policy impact for company"
  },
  "POST /mfg-companies/{id}/delete-policy": {
    tags: ["Mfg Companies"],
    summary: "Clear manufacturer policy (locks, restrictions, limits)",
    description:
      "Resets all operational locks, billing restrictions, and financial limits to defaults. Identity fields (code, name, emails, etc.) are unchanged."
  },

  // ── Product batches ─────────────────────────────────────────────────────
  "GET /api/product-batches": {
    tags: ["Product Batches"],
    summary: "List product batches",
    query: {
      key: { type: "string", description: "Search alias (same as q / search)" },
      page: { type: "integer" },
      limit: { type: "integer" },
      product_id: {
        type: "string",
        format: "uuid",
        description: "Filter by product UUID. Aliases: productId, product, id (mobile)."
      },
      productId: { type: "string", format: "uuid" },
      id: {
        type: "string",
        format: "uuid",
        description: "Mobile alias for product_id — filter batches belonging to this product."
      },
      batch_id: { type: "string", format: "uuid", description: "Filter to a single batch row" },
      search: { type: "string" },
      q: { type: "string" }
    }
  },
  "POST /api/product-batches": {
    tags: ["Product Batches"],
    summary: "Create product batch",
    body: {
      required: ["productId", "batchNumber"],
      properties: {
        productId: { type: "string", format: "uuid" },
        batchNumber: { type: "string", example: "BTH-001" },
        expiryDate: { type: "string", format: "date" },
        mfgDate: { type: "string", format: "date" },
        mrp: { type: "number" },
        purchaseRate: { type: "number" },
        saleRate: { type: "number" },
        stockQty: { type: "number" },
        freeQty: { type: "number" },
        looseStock: { type: "number" },
        looseUnitName: { type: "string" },
        packing: { type: "string" },
        hsnCode: { type: "string" },
        gstPercent: { type: "number" },
        vendorId: { type: "string", format: "uuid" },
        divisionId: { type: "string", format: "uuid" },
        mfgCompanyId: { type: "string", format: "uuid" },
        barcode: { type: "string" },
        onHold: { type: "boolean" }
      }
    }
  },
  "GET /api/product-batches/{id}": { tags: ["Product Batches"], summary: "Get product batch" },
  "PUT /api/product-batches/{id}": {
    tags: ["Product Batches"],
    summary: "Update product batch",
    body: {
      properties: {
        batchNumber: { type: "string" },
        expiryDate: { type: "string", format: "date" },
        mrp: { type: "number" },
        purchaseRate: { type: "number" },
        saleRate: { type: "number" },
        stockQty: { type: "number" },
        freeQty: { type: "number" },
        looseStock: { type: "number" },
        onHold: { type: "boolean" },
        barcode: { type: "string" }
      }
    }
  },
  "DELETE /api/product-batches/{id}": { tags: ["Product Batches"], summary: "Delete product batch" },
  "POST /api/product-batches/bulk-delete": {
    tags: ["Product Batches"],
    summary: "Bulk delete product batches",
    bodyRef: "IdsBody"
  },
  "GET /api/product-batches/check": {
    tags: ["Product Batches"],
    summary: "Check batch uniqueness",
    query: {
      product_id: { type: "string", format: "uuid" },
      batch_number: { type: "string" },
      exclude_id: { type: "string", format: "uuid" }
    }
  },
  "PATCH /product-batches/{id}/loose-stock": {
    tags: ["Product Batches"],
    summary: "Update loose stock",
    body: {
      required: ["looseStock"],
      properties: {
        looseStock: { type: "number" },
        looseUnitName: { type: "string" }
      }
    }
  },

  // ── Products ────────────────────────────────────────────────────────────
  "GET /products": {
    tags: ["Products"],
    summary: "List products (own inventory or wholesaler products for retailers)",
    description:
      "Default: lists the authenticated account’s own products.\n\n" +
      "Retailer marketplace mode: pass `source=wholesaler_products` / `marketplace` / `wholesaler` (or any wholesaler id filter) to list all products from ACTIVE connected wholesalers.\n\n" +
      "Filter by one or more wholesalers using `wholesaler_ids` as a comma-separated list or repeated query params.",
    query: {
      page: { type: "integer", minimum: 1, example: 1, description: "Page number (default 1)" },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 500,
        example: 50,
        description: "Page size (default 50, max 500)"
      },
      search: { type: "string", description: "Search product name/code/drug (alias: q)" },
      q: { type: "string", description: "Alias of search" },
      mfg_company_id: {
        type: "string",
        format: "uuid",
        description: "Own-inventory filter: manufacturing company id"
      },
      division_id: {
        type: "string",
        format: "uuid",
        description: "Own-inventory filter: division id"
      },
      require_active_batch: {
        type: "string",
        example: "true",
        description: "Own-inventory only: when true, only products with ≥1 live batch"
      },
      source: {
        type: "string",
        enum: ["own", "wholesaler_products", "wholesaler_catalog", "marketplace", "wholesaler"],
        example: "wholesaler_products",
        description:
          "Set to wholesaler_products / marketplace / wholesaler for retailer listing of connected wholesaler products. Also enabled automatically when wholesaler_ids is present. (wholesaler_catalog kept as legacy alias.)"
      },
      wholesaler_ids: {
        type: "string",
        example: "11111111-2222-3333-4444-555555555555,aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        description:
          "Retailer marketplace filter: array of wholesaler account UUIDs (comma-separated or repeated). Aliases: wholesaler_account_ids, wholesalerIds, wholesalerAccountIds. Omit to include all ACTIVE connected wholesalers."
      },
      wholesaler_account_ids: {
        type: "string",
        description: "Alias of wholesaler_ids (comma-separated UUID array)"
      },
      wholesaler_id: {
        type: "string",
        format: "uuid",
        description: "Single wholesaler filter (also accepted; prefer wholesaler_ids for multiple)"
      },
      wholesaler_account_id: {
        type: "string",
        format: "uuid",
        description: "Alias of wholesaler_id"
      }
    }
  },
  "POST /products": {
    tags: ["Products"],
    summary: "Create product",
    body: {
      required: ["name"],
      properties: {
        name: { type: "string", example: "Paracetamol 500mg" },
        code: { type: "string" }
      }
    }
  },
  "PUT /products/{id}": {
    tags: ["Products"],
    summary: "Update product",
    body: { required: ["name"], properties: { name: { type: "string" } } }
  },
  "DELETE /products/{id}": { tags: ["Products"], summary: "Delete product" },
  "POST /products/bulk-delete": { tags: ["Products"], summary: "Bulk delete products", bodyRef: "IdsBody" },
  "GET /products/check-code": {
    tags: ["Products"],
    summary: "Check product code uniqueness",
    query: { code: { type: "string" }, exclude_id: { type: "string", format: "uuid" } }
  },
  "GET /products/check-name": {
    tags: ["Products"],
    summary: "Check product name uniqueness",
    query: {
      name: { type: "string" },
      mfg_company_id: { type: "string", format: "uuid" },
      division_id: { type: "string", format: "uuid" },
      exclude_id: { type: "string", format: "uuid" }
    }
  },
  "GET /products/rich-search": {
    tags: ["Products"],
    summary: "Rich product search (with batches/suppliers)",
    query: {
      q: { type: "string" },
      include_batches: { type: "boolean" },
      include_suppliers: { type: "boolean" },
      limit: { type: "integer" }
    }
  },

  // ── Purchase invoices ───────────────────────────────────────────────────
  "GET /purchase-invoices": {
    tags: ["Purchase Invoices"],
    summary: "List purchase invoices",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      status: { type: "string" },
      vendor_id: { type: "string", format: "uuid" },
      division_id: { type: "string", format: "uuid" }
    }
  },
  "POST /purchase-invoices": {
    tags: ["Purchase Invoices"],
    summary: "Create purchase invoice",
    body: {
      required: ["invoiceDate", "items"],
      properties: {
        invoiceDate: { type: "string", format: "date" },
        vendorId: { type: "string", format: "uuid" },
        divisionId: { type: "string", format: "uuid" },
        vendorInvoiceNumber: { type: "string" },
        invoiceNumber: { type: "string" },
        dueDate: { type: "string", format: "date" },
        notes: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productId: { type: "string", format: "uuid" },
              batchNumber: { type: "string" },
              quantity: { type: "number" },
              freeQty: { type: "number" },
              purchaseRate: { type: "number" },
              mrp: { type: "number" },
              expiryDate: { type: "string", format: "date" },
              gstPercent: { type: "number" },
              discountPercent: { type: "number" }
            }
          }
        }
      }
    }
  },
  "GET /purchase-invoices/{id}": { tags: ["Purchase Invoices"], summary: "Get purchase invoice" },
  "PUT /purchase-invoices/{id}": {
    tags: ["Purchase Invoices"],
    summary: "Update purchase invoice",
    body: {
      properties: {
        invoiceDate: { type: "string", format: "date" },
        vendorId: { type: "string", format: "uuid" },
        divisionId: { type: "string", format: "uuid" },
        vendorInvoiceNumber: { type: "string" },
        dueDate: { type: "string", format: "date" },
        notes: { type: "string" },
        allowConfirmedEdit: { type: "boolean" },
        items: { type: "array", items: { type: "object" } }
      }
    }
  },
  "POST /purchase-invoices/{id}/confirm": {
    tags: ["Purchase Invoices"],
    summary: "Confirm purchase invoice",
    body: { properties: { confirmNote: { type: "string" } } }
  },
  "POST /purchase-invoices/{id}/cancel": {
    tags: ["Purchase Invoices"],
    summary: "Cancel purchase invoice",
    body: { properties: { cancelReason: { type: "string" } } }
  },
  "POST /purchase-invoices/{id}/delete": { tags: ["Purchase Invoices"], summary: "Delete purchase invoice" },
  "POST /purchase-invoices/bulk-confirm": {
    tags: ["Purchase Invoices"],
    summary: "Bulk confirm purchase invoices",
    bodyRef: "IdsBody"
  },
  "POST /purchase-invoices/bulk-cancel": {
    tags: ["Purchase Invoices"],
    summary: "Bulk cancel purchase invoices",
    body: {
      required: ["ids"],
      properties: {
        ids: { type: "array", items: { type: "string", format: "uuid" } },
        cancelReason: { type: "string" }
      }
    }
  },
  "POST /purchase-invoices/send-email": {
    tags: ["Purchase Invoices"],
    summary: "Email purchase invoices",
    bodyRef: "IdsBody"
  },

  // ── Purchase returns ────────────────────────────────────────────────────
  "GET /purchase-returns": {
    tags: ["Purchase Returns"],
    summary: "List purchase returns",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      status: { type: "string" },
      vendorId: { type: "string", format: "uuid" },
      purchaseInvoiceId: { type: "string", format: "uuid" }
    }
  },
  "POST /purchase-returns": {
    tags: ["Purchase Returns"],
    summary: "Create purchase return",
    body: {
      required: ["purchaseInvoiceId", "returnDate", "items"],
      properties: {
        purchaseInvoiceId: { type: "string", format: "uuid" },
        returnDate: { type: "string", format: "date" },
        returnReason: { type: "string" },
        creditNoteNumber: { type: "string" },
        returnNumber: { type: "string" },
        notes: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              purchaseInvoiceItemId: { type: "string", format: "uuid" },
              quantity: { type: "number" },
              reason: { type: "string" }
            }
          }
        }
      }
    }
  },
  "POST /purchase-returns/{id}/confirm": { tags: ["Purchase Returns"], summary: "Confirm purchase return" },

  // ── Vendor payments ─────────────────────────────────────────────────────
  "GET /vendor-payments": {
    tags: ["Vendor Payments"],
    summary: "List vendor payments",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      vendor_id: { type: "string", format: "uuid" },
      invoice_id: { type: "string", format: "uuid" }
    }
  },
  "POST /vendor-payments": {
    tags: ["Vendor Payments"],
    summary: "Create vendor payment",
    body: {
      required: ["vendorId", "amount", "paymentDate"],
      properties: {
        vendorId: { type: "string", format: "uuid" },
        invoiceId: { type: "string", format: "uuid" },
        amount: { type: "number" },
        paymentDate: { type: "string", format: "date" },
        paymentMode: { type: "string" },
        allocationType: { type: "string" },
        referenceNumber: { type: "string" },
        notes: { type: "string" }
      }
    }
  },
  "POST /vendor-payments/bulk-settle": {
    tags: ["Vendor Payments"],
    summary: "Bulk settle vendor invoices",
    body: {
      required: ["paymentDate"],
      properties: {
        invoiceIds: { type: "array", items: { type: "string", format: "uuid" } },
        ids: { type: "array", items: { type: "string", format: "uuid" } },
        paymentDate: { type: "string", format: "date" },
        paymentMode: { type: "string" },
        referenceNumber: { type: "string" },
        notes: { type: "string" }
      }
    }
  },

  // ── Customers ───────────────────────────────────────────────────────────
  "GET /customers": {
    tags: ["Customers"],
    summary: "List customers",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      q: { type: "string" },
      customer_type: { type: "string" },
      for_billing: { type: "boolean" }
    }
  },
  "POST /customers": {
    tags: ["Customers"],
    summary: "Create customer",
    body: {
      required: ["name"],
      properties: {
        name: { type: "string" },
        code: { type: "string" },
        phoneCountryCode: { type: "string", example: "+91" },
        phoneNumber: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        pinCode: { type: "string" },
        customerType: { type: "string" },
        gstNumber: { type: "string" },
        drugLicense1Number: { type: "string" },
        drugLicense2Number: { type: "string" },
        creditDays: { type: "integer" },
        creditLimit: { type: "number" },
        discountPercent: { type: "number" },
        isCashCustomer: { type: "boolean" },
        notes: { type: "string" }
      }
    }
  },
  "GET /customers/{id}": { tags: ["Customers"], summary: "Get customer" },
  "PUT /customers/{id}": {
    tags: ["Customers"],
    summary: "Update customer",
    body: {
      properties: {
        name: { type: "string" },
        code: { type: "string" },
        phoneCountryCode: { type: "string" },
        phoneNumber: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        customerType: { type: "string" },
        gstNumber: { type: "string" },
        creditDays: { type: "integer" },
        creditLimit: { type: "number" },
        discountPercent: { type: "number" },
        isCashCustomer: { type: "boolean" },
        notes: { type: "string" }
      }
    }
  },
  "DELETE /customers/{id}": { tags: ["Customers"], summary: "Delete customer" },
  "POST /customers/bulk-delete": { tags: ["Customers"], summary: "Bulk delete customers", bodyRef: "IdsBody" },
  "GET /customers/{id}/outstanding": { tags: ["Customers"], summary: "Customer outstanding" },
  "GET /customers/{id}/ledger/print": {
    tags: ["Customers"],
    summary: "Download customer ledger PDF",
    produces: "application/pdf"
  },
  "POST /customers/{id}/ledger/send-email": {
    tags: ["Customers"],
    summary: "Email customer ledger"
  },

  // ── Customer payments ───────────────────────────────────────────────────
  "GET /customer-payments": {
    tags: ["Customer Payments"],
    summary: "List customer payments",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      customer_id: { type: "string", format: "uuid" },
      invoice_id: { type: "string", format: "uuid" }
    }
  },
  "POST /customer-payments": {
    tags: ["Customer Payments"],
    summary: "Create customer payment",
    body: {
      required: ["customerId", "amount", "paymentDate"],
      properties: {
        customerId: { type: "string", format: "uuid" },
        invoiceId: { type: "string", format: "uuid" },
        amount: { type: "number" },
        paymentDate: { type: "string", format: "date" },
        paymentMode: { type: "string" },
        useAdvanceFirst: { type: "boolean" },
        allocations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              invoiceId: { type: "string", format: "uuid" },
              amount: { type: "number" }
            }
          }
        },
        referenceNumber: { type: "string" },
        notes: { type: "string" }
      }
    }
  },
  "POST /customer-payments/bulk-settle": {
    tags: ["Customer Payments"],
    summary: "Bulk settle customer invoices",
    body: {
      required: ["paymentDate"],
      properties: {
        invoiceIds: { type: "array", items: { type: "string", format: "uuid" } },
        ids: { type: "array", items: { type: "string", format: "uuid" } },
        paymentDate: { type: "string", format: "date" },
        paymentMode: { type: "string" },
        referenceNumber: { type: "string" },
        notes: { type: "string" }
      }
    }
  },

  // ── Sales invoices ──────────────────────────────────────────────────────
  "GET /sales-invoices": {
    tags: ["Sales Invoices"],
    summary: "List sales invoices",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      status: { type: "string" },
      customer_id: { type: "string", format: "uuid" }
    }
  },
  "POST /sales-invoices": {
    tags: ["Sales Invoices"],
    summary: "Create sales invoice",
    body: {
      required: ["invoiceDate", "items"],
      properties: {
        customerId: { type: "string", format: "uuid" },
        invoiceDate: { type: "string", format: "date" },
        walkInName: { type: "string" },
        walkInPhone: { type: "string" },
        rateType: { type: "string", example: "MRP" },
        billType: { type: "string" },
        globalDiscountPercent: { type: "number" },
        notes: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              batchId: { type: "string", format: "uuid" },
              productId: { type: "string", format: "uuid" },
              quantity: { type: "number" },
              freeQty: { type: "number" },
              rate: { type: "number" },
              discountPercent: { type: "number" }
            }
          }
        }
      }
    }
  },
  "GET /sales-invoices/{id}": { tags: ["Sales Invoices"], summary: "Get sales invoice" },
  "PUT /sales-invoices/{id}": {
    tags: ["Sales Invoices"],
    summary: "Update sales invoice",
    body: {
      properties: {
        customerId: { type: "string", format: "uuid" },
        invoiceDate: { type: "string", format: "date" },
        rateType: { type: "string" },
        billType: { type: "string" },
        globalDiscountPercent: { type: "number" },
        notes: { type: "string" },
        items: { type: "array", items: { type: "object" } }
      }
    }
  },
  "PATCH /sales-invoices/{id}/rate-type": {
    tags: ["Sales Invoices"],
    summary: "Change rate type",
    body: { required: ["rateType"], properties: { rateType: { type: "string", example: "PTR" } } }
  },
  "PATCH /sales-invoices/{id}/global-discount": {
    tags: ["Sales Invoices"],
    summary: "Apply global discount",
    body: {
      required: ["globalDiscountPercent"],
      properties: { globalDiscountPercent: { type: "number", example: 5 } }
    }
  },
  "POST /sales-invoices/{id}/items/{itemId}/scheme": {
    tags: ["Sales Invoices"],
    summary: "Override line scheme",
    body: {
      properties: {
        discountPercent: { type: "number" },
        freeQty: { type: "number" }
      }
    }
  },
  "POST /sales-invoices/{id}/loose-sale": {
    tags: ["Sales Invoices"],
    summary: "Record loose sale",
    body: {
      required: ["batchId", "looseQty"],
      properties: {
        batchId: { type: "string", format: "uuid" },
        looseQty: { type: "number" },
        note: { type: "string" }
      }
    }
  },
  "POST /sales-invoices/{id}/confirm": {
    tags: ["Sales Invoices"],
    summary: "Confirm sales invoice",
    body: { properties: { markPaidAtConfirm: { type: "boolean" } } }
  },
  "POST /sales-invoices/{id}/cancel": {
    tags: ["Sales Invoices"],
    summary: "Cancel sales invoice",
    body: { properties: { cancelReason: { type: "string" } } }
  },
  "POST /sales-invoices/bulk-confirm": {
    tags: ["Sales Invoices"],
    summary: "Bulk confirm sales invoices",
    bodyRef: "IdsBody"
  },
  "POST /sales-invoices/bulk-cancel": {
    tags: ["Sales Invoices"],
    summary: "Bulk cancel sales invoices",
    body: {
      required: ["ids"],
      properties: {
        ids: { type: "array", items: { type: "string", format: "uuid" } },
        cancelReason: { type: "string" }
      }
    }
  },
  "GET /sales-invoices/{id}/print": {
    tags: ["Sales Invoices"],
    summary: "Print sales invoice PDF",
    produces: "application/pdf"
  },
  "POST /sales-invoices/print-bulk": {
    tags: ["Sales Invoices"],
    summary: "Bulk print sales invoices",
    bodyRef: "IdsBody"
  },
  "POST /sales-invoices/send-email": {
    tags: ["Sales Invoices"],
    summary: "Email sales invoices",
    bodyRef: "IdsBody"
  },
  "GET /sales-invoices/by-barcode": {
    tags: ["Sales Invoices"],
    summary: "Lookup by barcode",
    query: { barcode: { type: "string" } }
  },

  // ── Sales returns ───────────────────────────────────────────────────────
  "GET /sales-returns": {
    tags: ["Sales Returns"],
    summary: "List sales returns",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      status: { type: "string" },
      customerId: { type: "string", format: "uuid" }
    }
  },
  "POST /sales-returns": {
    tags: ["Sales Returns"],
    summary: "Create sales return",
    body: {
      required: ["customerId", "returnDate", "items"],
      properties: {
        customerId: { type: "string", format: "uuid" },
        returnDate: { type: "string", format: "date" },
        salesInvoiceId: { type: "string", format: "uuid" },
        returnReason: { type: "string" },
        notes: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              salesInvoiceItemId: { type: "string", format: "uuid" },
              batchId: { type: "string", format: "uuid" },
              quantity: { type: "number" },
              reason: { type: "string" }
            }
          }
        }
      }
    }
  },
  "GET /sales-returns/{id}": { tags: ["Sales Returns"], summary: "Get sales return" },
  "POST /sales-returns/{id}/confirm": { tags: ["Sales Returns"], summary: "Confirm sales return" },
  "POST /sales-returns/{id}/cancel": {
    tags: ["Sales Returns"],
    summary: "Cancel sales return",
    body: { properties: { cancelReason: { type: "string" } } }
  },

  // ── Prescriptions ───────────────────────────────────────────────────────
  "GET /prescriptions": {
    tags: ["Prescriptions"],
    summary: "List prescriptions",
    query: {
      page: { type: "integer" },
      limit: { type: "integer" },
      doctor: { type: "string" },
      search: { type: "string" }
    }
  },
  "GET /prescriptions/{id}": { tags: ["Prescriptions"], summary: "Get prescription" },

  // ── Announcement ────────────────────────────────────────────────────────
  "GET /api/announcement": { tags: ["Announcement"], summary: "Get announcement" },

  // ── Uploads ─────────────────────────────────────────────────────────────
  "POST /uploads/presign": {
    tags: ["Uploads"],
    summary: "Get S3 presigned upload URL",
    security: [],
    body: {
      required: ["docType", "contentType", "originalName"],
      properties: {
        docType: { type: "string", example: "GST_CERTIFICATE" },
        contentType: { type: "string", example: "image/jpeg" },
        originalName: { type: "string", example: "gst.jpg" }
      }
    }
  },
  "POST /uploads/access-url": {
    tags: ["Uploads"],
    summary: "Get signed access URL for uploaded file",
    body: {
      properties: {
        key: { type: "string" },
        fileUrl: { type: "string" }
      }
    }
  },

  // ── Notifications ───────────────────────────────────────────────────────
  "GET /notifications": {
    tags: ["Notifications"],
    summary: "List notifications",
    query: {
      limit: { type: "integer" },
      offset: { type: "integer" },
      unread_only: { type: "boolean" }
    }
  },
  "GET /notifications/unread-count": { tags: ["Notifications"], summary: "Unread notification count" },
  "POST /notifications/mark-read": {
    tags: ["Notifications"],
    summary: "Mark notifications as read",
    body: {
      properties: {
        all: { type: "boolean" },
        ids: { type: "array", items: { type: "string", format: "uuid" } }
      }
    }
  },
  "POST /notifications/broadcast": {
    tags: ["Notifications"],
    summary: "Broadcast notification",
    body: {
      required: ["title"],
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        message: { type: "string" },
        audience: { type: "string", example: "ALL" },
        userIds: { type: "array", items: { type: "string", format: "uuid" } },
        actionPath: { type: "string" }
      }
    }
  },

  // ── Supplier products / vendor manufacturers ────────────────────────────
  "GET /supplier-products": {
    tags: ["Supplier Products"],
    summary: "List supplier products",
    query: { vendor_id: { type: "string", format: "uuid" }, product_id: { type: "string", format: "uuid" } }
  },
  "POST /supplier-products": {
    tags: ["Supplier Products"],
    summary: "Upsert supplier product",
    body: {
      required: ["vendorId", "productId"],
      properties: {
        vendorId: { type: "string", format: "uuid" },
        productId: { type: "string", format: "uuid" },
        purchaseRate: { type: "number" },
        notes: { type: "string" }
      }
    }
  },
  "POST /supplier-products/{id}/delete": { tags: ["Supplier Products"], summary: "Delete supplier product" },
  "GET /vendor-manufacturers": {
    tags: ["Vendor Manufacturers"],
    summary: "List vendor manufacturers",
    query: { vendor_id: { type: "string", format: "uuid" } }
  },
  "POST /vendor-manufacturers": {
    tags: ["Vendor Manufacturers"],
    summary: "Upsert vendor manufacturer link",
    body: {
      required: ["vendorId", "mfgCompanyId"],
      properties: {
        vendorId: { type: "string", format: "uuid" },
        mfgCompanyId: { type: "string", format: "uuid" }
      }
    }
  },
  "POST /vendor-manufacturers/{id}/delete": {
    tags: ["Vendor Manufacturers"],
    summary: "Delete vendor manufacturer link"
  },

  // ── Reports ─────────────────────────────────────────────────────────────
  "GET /reports/day-book": {
    tags: ["Reports"],
    summary: "Day book report",
    query: { date: { type: "string", format: "date" } }
  },
  "GET /reports/gstr-1": {
    tags: ["Reports"],
    summary: "GSTR-1 outward supplies working paper",
    query: {
      date_from: { type: "string", format: "date" },
      date_to: { type: "string", format: "date" }
    }
  },
  "GET /reports/gstr-2": {
    tags: ["Reports"],
    summary: "GSTR-2 inward supplies working paper",
    query: {
      date_from: { type: "string", format: "date" },
      date_to: { type: "string", format: "date" }
    }
  },
  "GET /reports/mfg-stockist": {
    tags: ["Reports"],
    summary: "Mfg stockist report",
    query: { q: { type: "string" } }
  },
  "GET /reports/non-moving": {
    tags: ["Reports"],
    summary: "Non-moving stock report",
    query: { days: { type: "integer", example: 90 }, limit: { type: "integer" } }
  },
  "GET /reports/product-supplier": {
    tags: ["Reports"],
    summary: "Product-supplier report",
    query: {
      q: { type: "string" },
      product_id: { type: "string", format: "uuid" },
      limit: { type: "integer" }
    }
  },

  // ── Dashboard ───────────────────────────────────────────────────────────
  "GET /dashboard/alerts": { tags: ["Dashboard"], summary: "Dashboard alerts" },
  "GET /dashboard/summary": {
    tags: ["Dashboard"],
    summary: "Dashboard summary",
    query: {
      recent_limit: { type: "integer" },
      expiry_days: { type: "integer" }
    }
  },

  // ── Import ──────────────────────────────────────────────────────────────
  "POST /import/parse": {
    tags: ["Import"],
    summary: "Parse import file",
    body: {
      required: ["entityType", "filename", "contentBase64"],
      properties: {
        entityType: {
          type: "string",
          example: "PRODUCTS",
          description: "Entity type to import (PRODUCTS, CUSTOMERS, VENDORS, etc.)"
        },
        filename: { type: "string", example: "products.xlsx" },
        contentBase64: { type: "string", description: "Base64-encoded file contents" }
      }
    }
  },
  "POST /import/validate": {
    tags: ["Import"],
    summary: "Validate import column mappings",
    body: {
      required: ["jobId", "columnMappings"],
      properties: {
        jobId: { type: "string", format: "uuid" },
        columnMappings: { type: "object", additionalProperties: { type: "string" } },
        duplicateStrategy: { type: "string", enum: ["SKIP", "UPDATE", "ERROR"] }
      }
    }
  },
  "POST /import/execute": {
    tags: ["Import"],
    summary: "Execute import job",
    body: {
      required: ["jobId"],
      properties: {
        jobId: { type: "string", format: "uuid" },
        duplicateStrategy: { type: "string", enum: ["SKIP", "UPDATE", "ERROR"] },
        skipErrors: { type: "boolean" }
      }
    }
  },
  "GET /import/jobs": {
    tags: ["Import"],
    summary: "List import jobs",
    query: { limit: { type: "integer" }, entityType: { type: "string" } }
  },
  "GET /import/jobs/{id}": { tags: ["Import"], summary: "Get import job" },
  "GET /import/template-meta": {
    tags: ["Import"],
    summary: "Import template metadata",
    query: { entityType: { type: "string" } }
  },

  // ── Orders ──────────────────────────────────────────────────────────────
  "POST /orders": {
    tags: ["Orders"],
    summary: "Create purchase order (retailer)",
    description:
      "Retailer places an order against an ACTIVE connected wholesaler. Each line must reference a wholesaler `product_id` with qty > 0. Unit price is taken from the wholesaler’s nearest-expiry batch sales rate. Aliases: wholesalerAccountId, retailerNotes, productId, quantity.",
    body: {
      required: ["wholesaler_account_id", "items"],
      properties: {
        wholesaler_account_id: {
          type: "string",
          format: "uuid",
          example: "11111111-2222-3333-4444-555555555555",
          description: "Wholesaler account UUID (must have ACTIVE link)"
        },
        wholesalerAccountId: {
          type: "string",
          format: "uuid",
          description: "CamelCase alias of wholesaler_account_id"
        },
        retailer_notes: {
          type: "string",
          example: "Please deliver before Friday. Prefer nearest expiry batches.",
          description: "Optional note from retailer"
        },
        retailerNotes: {
          type: "string",
          description: "CamelCase alias of retailer_notes"
        },
        items: {
          type: "array",
          minItems: 1,
          description: "Order lines. Use product_id + qty (or productId + quantity).",
          items: {
            type: "object",
            required: ["product_id", "qty"],
            properties: {
              product_id: {
                type: "string",
                format: "uuid",
                example: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                description: "Wholesaler products.id"
              },
              productId: {
                type: "string",
                format: "uuid",
                description: "CamelCase alias of product_id"
              },
              qty: {
                type: "number",
                example: 10,
                description: "Ordered quantity (must be > 0)"
              },
              quantity: {
                type: "number",
                example: 10,
                description: "Alias of qty"
              }
            }
          }
        }
      },
      example: {
        wholesaler_account_id: "11111111-2222-3333-4444-555555555555",
        retailer_notes: "Please deliver before Friday. Prefer nearest expiry batches.",
        items: [
          { product_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", qty: 10 },
          { product_id: "ffffffff-1111-2222-3333-444444444444", qty: 5 }
        ]
      },
      examples: {
        singleItem: {
          summary: "Single product order",
          value: {
            wholesaler_account_id: "11111111-2222-3333-4444-555555555555",
            items: [{ product_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", qty: 10 }]
          }
        },
        multipleItems: {
          summary: "Multiple products with notes",
          value: {
            wholesaler_account_id: "11111111-2222-3333-4444-555555555555",
            retailer_notes: "Urgent stock refill for weekend demand.",
            items: [
              { product_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", qty: 20 },
              { product_id: "ffffffff-1111-2222-3333-444444444444", qty: 8 },
              { product_id: "99999999-8888-7777-6666-555555555555", qty: 3 }
            ]
          }
        },
        camelCaseAliases: {
          summary: "CamelCase field aliases",
          value: {
            wholesalerAccountId: "11111111-2222-3333-4444-555555555555",
            retailerNotes: "Call before dispatch.",
            items: [{ productId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", quantity: 12 }]
          }
        }
      }
    }
  },
  "GET /orders/my-orders": {
    tags: ["Orders"],
    summary: "My orders (retailer)",
    description:
      "Lists orders placed by the logged-in retailer. Supports status, wholesaler, search, date range, and pagination filters. Status may be a single value or comma-separated list.",
    query: {
      status: {
        type: "string",
        example: "PENDING",
        description:
          "Filter by order status. Single value or comma-separated. Allowed: PENDING, ACCEPTED, REJECTED, DISPATCHED, DELIVERED, CANCELLED. Example: PENDING,ACCEPTED"
      },
      wholesaler_account_id: {
        type: "string",
        format: "uuid",
        description:
          "Filter orders for one wholesaler. Aliases: wholesalerAccountId, wholesaler_id, wholesalerId"
      },
      wholesaler_id: {
        type: "string",
        format: "uuid",
        description: "Alias of wholesaler_account_id"
      },
      search: {
        type: "string",
        example: "ORD-2026",
        description: "Search by order_number or wholesaler firm name (alias: q)"
      },
      q: {
        type: "string",
        description: "Alias of search"
      },
      date_from: {
        type: "string",
        format: "date",
        example: "2026-09-01",
        description:
          "Inclusive start date (YYYY-MM-DD or ISO datetime). Aliases: from_date, dateFrom, fromDate. Filters on placed_at."
      },
      date_to: {
        type: "string",
        format: "date",
        example: "2026-09-30",
        description:
          "Inclusive end date (YYYY-MM-DD or ISO datetime). Aliases: to_date, dateTo, toDate. Filters on placed_at."
      },
      page: {
        type: "integer",
        minimum: 1,
        example: 1,
        description: "Page number (default 1)"
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 200,
        example: 20,
        description: "Page size (default 20, max 200)"
      }
    }
  },
  "GET /orders/incoming": {
    tags: ["Orders"],
    summary: "Incoming orders (wholesaler)",
    query: {
      page: { type: "integer", minimum: 1, example: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, example: 20 },
      status: {
        type: "string",
        example: "PENDING",
        description: "PENDING | ACCEPTED | REJECTED | DISPATCHED | DELIVERED | CANCELLED"
      },
      retailer_account_id: {
        type: "string",
        format: "uuid",
        description: "Filter by retailer (aliases: retailerAccountId)"
      },
      search: { type: "string", description: "Search order_number or retailer firm name (alias: q)" },
      q: { type: "string" }
    }
  },
  "GET /orders/{id}": { tags: ["Orders"], summary: "Get order" },
  "GET /orders/{id}/wholesaler-view": { tags: ["Orders"], summary: "Wholesaler order view" },
  "POST /orders/{id}/accept": {
    tags: ["Orders"],
    summary: "Accept order (wholesaler)",
    body: {
      properties: {
        wholesaler_notes: { type: "string" },
        item_overrides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item_id: { type: "string", format: "uuid" },
              quantity: { type: "number" },
              rate: { type: "number" }
            }
          }
        }
      }
    }
  },
  "POST /orders/{id}/reject": {
    tags: ["Orders"],
    summary: "Reject order (wholesaler)",
    body: { properties: { rejection_reason: { type: "string" } } }
  },
  "POST /orders/{id}/dispatch": { tags: ["Orders"], summary: "Dispatch order (wholesaler)" },
  "POST /orders/{id}/cancel": { tags: ["Orders"], summary: "Cancel order (retailer)" },
  "POST /orders/{id}/cancel-by-wholesaler": {
    tags: ["Orders"],
    summary: "Cancel order (wholesaler)"
  },
  "POST /orders/{id}/confirm-delivery": { tags: ["Orders"], summary: "Confirm delivery (retailer)" },
  "POST /orders/{id}/create-purchase": {
    tags: ["Orders"],
    summary: "Create purchase invoice from order"
  },

  // ── Wholesaler links / match requests ───────────────────────────────────
  "GET /wholesaler-links/active-wholesalers": {
    tags: ["Wholesaler Links"],
    summary: "List all active wholesalers (retailer)",
    description:
      "Returns approved, non-blocked wholesaler accounts. Includes current match-link status for the retailer if any. Supports pagination.",
    query: {
      page: { type: "integer", minimum: 1, example: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, example: 50 },
      search: { type: "string", description: "Filter by firm/name/city/state/email" },
      q: { type: "string" }
    }
  },
  "POST /wholesaler-links/connect": {
    tags: ["Wholesaler Links"],
    summary: "Send match request to wholesaler (retailer)",
    description:
      "Creates a PENDING match request. Allowed when no link exists or previous status was REJECTED. Blocked when PENDING, ACTIVE, or BLOCKED.",
    body: {
      required: ["wholesaler_account_id"],
      properties: {
        wholesaler_account_id: { type: "string", format: "uuid" },
        request_message: { type: "string", example: "Please connect so we can order stock." }
      }
    }
  },
  "GET /wholesaler-links/incoming": {
    tags: ["Wholesaler Links"],
    summary: "Incoming match requests (wholesaler)",
    description: "Defaults to PENDING. Pass status to filter ACTIVE/REJECTED/BLOCKED. Supports pagination.",
    query: {
      page: { type: "integer", minimum: 1, example: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, example: 50 },
      status: {
        type: "string",
        enum: ["PENDING", "ACTIVE", "REJECTED", "BLOCKED"]
      }
    }
  },
  "POST /wholesaler-links/{id}/accept": {
    tags: ["Wholesaler Links"],
    summary: "Accept match request (wholesaler)",
    body: {
      properties: {
        credit_days: { type: "integer", example: 15 },
        credit_limit: { type: "number", example: 50000 },
        discount_percent: { type: "number", example: 2.5 }
      }
    }
  },
  "POST /wholesaler-links/{id}/reject": {
    tags: ["Wholesaler Links"],
    summary: "Reject/cancel match request (wholesaler)",
    description: "Sets status to REJECTED. Retailer can send a new request afterwards.",
    body: {
      properties: {
        rejection_reason: { type: "string", example: "Incomplete documents" }
      }
    }
  },
  "GET /wholesaler-links/accepted": {
    tags: ["Wholesaler Links"],
    summary: "Accepted wholesalers list (retailer)",
    description: "Returns wholesalers with ACTIVE match status for the current retailer. Supports pagination.",
    query: {
      page: { type: "integer", minimum: 1, example: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, example: 50 }
    }
  },
  "GET /wholesaler-links/{wholesalerAccountId}/products": {
    tags: ["Wholesaler Links"],
    summary: "Products of an accepted wholesaler (retailer)",
    description:
      "Requires ACTIVE connection. Returns all non-deleted products for the wholesaler (with batch-derived sales rate / stock). Supports pagination and search.",
    query: {
      page: { type: "integer", minimum: 1, example: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, example: 50 },
      search: { type: "string", description: "Filter by product name/code/drug name" },
      q: { type: "string", description: "Alias of search" }
    }
  },
  "GET /wholesaler-links/my-connections": {
    tags: ["Wholesaler Links"],
    summary: "All my wholesaler connections (retailer)",
    description: "All link statuses: PENDING, ACTIVE, REJECTED, BLOCKED. Supports pagination.",
    query: {
      page: { type: "integer", minimum: 1, example: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, example: 50 },
      status: {
        type: "string",
        enum: ["PENDING", "ACTIVE", "REJECTED", "BLOCKED"]
      }
    }
  },
  "PATCH /wholesaler-links/{id}": {
    tags: ["Wholesaler Links"],
    summary: "Update wholesaler link (wholesaler)",
    body: {
      properties: {
        status: {
          type: "string",
          enum: ["PENDING", "ACTIVE", "REJECTED", "BLOCKED"],
          example: "ACTIVE"
        },
        credit_days: { type: "integer" },
        credit_limit: { type: "number" },
        discount_percent: { type: "number" }
      }
    }
  }
};