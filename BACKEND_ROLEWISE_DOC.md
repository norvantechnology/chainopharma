## Chaino Pharma Backend  Role-wise Module & Logic Documentation (No Code)

This document describes the **end-to-end backend logic** for Chaino Pharma:
- **Frontend → API → DB** flow
- **Role-wise behavior** (permission-gated)
- **Every module and API**: inputs, validations, conditions, side effects, and responses
- **How modules connect** (inventory, purchases, sales, payments, ledgers, reports, notifications, imports)

> Notes
> - “Controller/handler” refers to `user/backend/src/handlers/**`.
> - “Shared logic” refers to `user/backend/src/shared/**`.
> - DB schema is established by migrations in `user/backend/sql/RUN_ORDER.txt`.
> - Stock correctness is ledger-based: **`inventory_txns` is the source of truth** and is **immutable**.

---

## 1) System overview

### 1.1 Tenancy (account isolation)
- Every row belongs to an `account_id` (tenant).
- Every handler resolves `accountId` from the authenticated user session/claims.
- All DB operations must constrain by `account_id`.
- Soft-deletable tables use `deleted_at IS NULL` filtering.

### 1.2 Authentication + session model
- Access token (short TTL) + refresh token (longer TTL).
- Most endpoints require Authorization header; auth endpoints do not.
- Some flows (OTP, password reset) use server-issued temporary tokens/records.

### 1.3 Authorization (RBAC)
- The backend enforces: **resource** + **action** permission checks.
- Role membership → permissions → runtime access gates.
- Frontend hides controls based on `/access/me`, but backend is the final authority.

### 1.4 Inventory and accounting correctness (key invariant)

#### Source of truth
- `inventory_txns` is immutable (UPDATE/DELETE blocked by trigger).
- `product_batches.current_stock` and `current_free_stock` are **cached totals** maintained by DB trigger on `inventory_txns` INSERT.

#### Implications
- Confirming purchase/sale/return inserts `inventory_txns`.
- Cancelling/edits that affect stock must insert compensating `inventory_txns` (typically `ADJUSTMENT` or cancellation/reversal types).
- Editing “opening stock” is only allowed **before any non-opening txns exist** for that batch (special exception).

### 1.5 Financial year & sequencing
- Uses `invoice_counters` for atomic, FY-aware numbering.
- FY is April 1 – March 31 (India).

---

## 2) How modules connect (the big picture)

### 2.1 Core objects and relationships
- **Products (`products`)**: master items.
- **Batches (`product_batches`)**: per product stock containers + rates/pricing.
- **Inventory ledger (`inventory_txns`)**: every stock move against a batch.
- **Purchase invoices (`purchase_invoices` + `purchase_invoice_items`)**:
  - On confirm: inserts PURCHASE txns → increases batch stock.
  - Can update batch pricing and writes `batch_price_history`.
  - Can auto-consume vendor advances (ON_ACCOUNT).
- **Sales invoices (`sales_invoices` + `sales_invoice_items`)**:
  - On confirm: inserts SALE txns (negative) → decreases batch stock.
  - Retailer loose sale can insert BREAK_PACK + LOOSE_SALE.
  - Tax invoice adds GST split validations/fields.
- **Payments**
  - Customer: `customer_payments` (INVOICE vs ON_ACCOUNT advances).
  - Vendor: `vendor_payments` (INVOICE vs ON_ACCOUNT advances).
  - Division: `division_payments` (wholesaler flow).
  - Payments update invoice payment summaries (paid/balance/payment_status).
- **Returns**
  - Purchase returns reduce stock (PURCHASE_RETURN txns).
  - Sales returns add stock back (SALE_RETURN txns).
- **Ledgers**
  - Customer/Vendor ledger pages are UNIONs across invoices, payments, returns with running balance.
- **Reports**
  - Day book uses invoices + payments to compute daily cash position.
  - Non-moving uses last SALE txn dates per batch.
  - Product-supplier and Mfg-stockist derive supplier mappings from purchases + mapping tables.

### 2.2 Retailer vs Wholesaler behavior
- Retailer UI uses vendor-based purchases and pharmacy flows (loose sale, supplier mapping).
- Wholesaler (or non-retailer) may use division-based purchase flows.
- Some screens are permission-gated or rendered differently based on business type.

---

## 3) Role-wise access model (practical)

Backend doesn’t hardcode “ADMIN/STAFF” names everywhere; it checks permissions.
Typical operational roles:

### 3.1 OWNER/ADMIN (full control)
- Access control: create users/roles, assign permissions.
- All masters: products, batches, vendors, customers, divisions, manufacturers.
- All transactions: purchase/sales, returns, payments.
- Reports, dashboards, imports, notifications broadcast.

### 3.2 STAFF/PHARMACIST (daily operations)
- Sales billing, sales returns.
- Purchases and supplier payments (depending on permission assignment).
- View masters, limited edits.
- Usually no access control changes.

### 3.3 Read-only roles
- Can only view: lists, reports, ledgers.
- No create/update/delete/confirm actions.

> Exact capabilities are determined by the permission matrix (resources + actions).

---

## 4) Shared backend building blocks (used by multiple controllers)

### 4.1 `shared/auth.js` + permission checks
Flow used by most handlers:
- Parse bearer token → verify JWT → extract `actorId`.
- Resolve actor permissions and account context.
- Enforce required permission (resource + action).
- Return standardized error response if denied.

### 4.2 `shared/db.js`
- `query(sql, params)` for SQL execution.
- `withTransaction(fn)` for atomic multi-step workflows.

### 4.3 `shared/response.js`
- Standard response envelope:
  - Success: `ok`, `created`
  - Error: `fail` with error codes + messages + optional details.

### 4.4 `shared/dateFilters.js`
- Normalizes date range query parameters across APIs.
- Supports multiple query param naming styles and case-insensitive key lookup.
- Applies `::date` comparisons for consistent date filtering.

### 4.5 `shared/sales.js` and `shared/purchase.js`
Key cross-module responsibilities:
- Input cleaning (`clean`, numeric parsing).
- Validations (GST slabs, payment status consistency).
- Totals calculations (discount, gst, totals, round-off in sales).
- Next document number generation (atomic `invoice_counters`, FY-aware).
- Payment summary refresh (purchase invoices).

### 4.6 `shared/productBatchCalc.js`
- Computes derived batch values:
  - Landing cost
  - Discount/net rate
  - Sales with GST
  - Margin metrics
- Used whenever batch pricing is created/updated from purchase/batch master operations.

### 4.7 `shared/supplierProducts.js`
- Maintains supplier-product mapping derived from confirmed purchases:
  - last supplied date
  - typical purchase rate (where applicable)

### 4.8 Data integrity hardening (DB triggers)
From migrations (not exhaustive):
- Inventory txn immutability trigger (blocks update/delete).
- Stock cache trigger (updates current_stock/current_free_stock on INSERT).
- Updated_at triggers for master tables.

---

## 5) Frontend → Backend mapping (where calls originate)

Frontend services call backend paths using `apiClient`:
- `user/frontend/src/services/*Service.js` are the API clients.
- Pages (`user/frontend/src/pages/*.jsx`) call services.
- Shared UI primitives: `CommonTable`, `CommonModal`, `CommonDatePicker`.

Key page → service → API examples:
- Purchases page → `purchaseService.listPurchaseInvoices` → `GET /purchase-invoices`
- Billing page → `salesService.*` → `sales-invoices` endpoints
- Supplier payments page → `purchaseService.listVendorPayments` → `GET /vendor-payments`
- Customer payments page → `salesService.listCustomerPayments` → `GET /customer-payments`
- Reports pages → `reportService.*` → `/reports/*`

---

## 6) API modules  detailed flows

For each API below:
- **Permission gate**: resource/action required
- **Inputs**: path/query/body
- **Validations**
- **DB interactions**
- **Side effects**
- **Responses**

> Because handlers are numerous, the structure is grouped by module folder.

---

## 6A) Auth module (`handlers/auth/*`)

### POST `/auth/signup`
- **Purpose**: Create account + initial user.
- **Validations**: required identity fields, password policy, uniqueness constraints.
- **DB writes**:
  - User record
  - Default role membership
  - Session/token setup
- **Response**: access/refresh tokens + user snapshot.

### POST `/auth/login`
- **Purpose**: Authenticate and start session.
- **Validations**: email/phone + password match; user active/approved.
- **DB writes**: session record (refresh token), last login stamps.
- **Response**: access/refresh tokens, user profile snapshot.

### POST `/auth/refresh`
- **Purpose**: refresh access token using refresh token.
- **Validations**: refresh token valid + not expired + belongs to user.
- **DB writes**: rotate refresh token (if rotation enabled), update session timestamps.
- **Response**: new access token + expiry.

### POST `/auth/logout`
- **Purpose**: invalidate refresh session.
- **Validations**: valid auth.
- **DB writes**: revoke/delete session token.
- **Response**: ok.

### POST `/auth/password/change`
- **Purpose**: user changes password.
- **Validations**: current password matches; new password meets policy.
- **DB writes**: update password hash; optionally revoke sessions.

### POST `/auth/otp/request`, POST `/auth/otp/verify`
- **Purpose**: OTP-based login flows.
- **Validations**: rate limits, OTP correctness, expiry.
- **DB writes**: OTP token records, session issuance on verify.

### POST `/auth/password/forgot/*`
- **Purpose**: reset password via token.
- **Validations**: reset token valid + not expired.
- **DB writes**: update password; invalidate reset token; optionally revoke sessions.

---

## 6B) User module (`handlers/user/*`)

### GET `/me`
- **Purpose**: returns current user + account profile.
- **Dependencies**: auth token must be valid.
- **Response**: user details, firm info, business type, settings snapshot.

### POST `/me/update`
- **Purpose**: update current user profile.
- **Validations**: allowed fields only, format checks.
- **DB writes**: update user record.

---

## 6C) Access control (`handlers/access/*`)

### GET `/access/me`
- **Purpose**: get effective permissions for the actor.
- **Used by frontend**: gate menus/buttons.

### GET/POST `/access/roles`, POST `/access/roles/{id}/update`, POST `/access/roles/{id}`
- **Purpose**: manage roles and permissions.
- **Validations**:
  - role name unique per account (soft-delete aware)
  - permissions values must exist in permission_resources
- **DB writes**: roles, permission assignments, memberships.

### GET/POST `/access/users`, POST `/access/users/{id}/update`, POST `/access/users/{id}/delete`
- **Purpose**: manage users.
- **Validations**: email uniqueness within tenant, role assignment consistency.

### POST `/access/users/{id}/role`
- **Purpose**: assign a role to a user.
- **Condition**: cannot remove last admin/owner (if enforced).

### GET `/access/permission-resources`
- **Purpose**: list resources and metadata for role editor UI.

---

## 6D) Vendors (`handlers/vendors/*`) + Vendor Ledger

### GET `/vendors`
- **Inputs**: search, pagination, active filters.
- **Validations**: none beyond safe parsing.
- **DB reads**: vendors table, soft-delete filter.

### POST `/vendors`
- **Validations**:
  - required name
  - code generation rules (if code optional)
  - phone compatibility rules
- **Writes**: vendor create with audit columns.

### POST `/vendors/{id}/update`
- **Validations**: vendor exists in account, not soft-deleted.
- **Writes**: update allowed fields.

### POST `/vendors/{id}/delete`, POST `/vendors/bulk-delete`
- **Validations**:
  - vendor not referenced by immutable confirmed docs (depending on constraints)
- **Writes**: soft delete or logical delete path.

### GET `/vendors/{id}/ledger`
- **Purpose**: supplier ledger (running balance).
- **Reads**:
  - Purchase invoices (confirmed)
  - Vendor payments (invoice + on-account)
  - Purchase returns (confirmed)
- **Output**:
  - ledger rows ordered by date/time
  - running balance computed
  - summary totals

---

## 6E) Customers (`handlers/customers/*`) + Outstanding + Ledger Print

### GET `/customers`
- **Inputs**: search, type filters, excludeWalkIn flag.
- **Condition**: retailer UI typically excludes walk-in customers from master list.

### POST `/customers`, PUT `/customers/{id}`, DELETE `/customers/{id}`, POST `/customers/bulk-delete`
- **Validations**:
  - unique name/code (soft-delete aware)
  - credit days/limit non-negative
  - compliance fields format

### GET `/customers/{id}/outstanding`
- **Reads**: confirmed unpaid/partial sales invoices.
- **Outputs**:
  - outstanding amount, bill count, oldest bill age
  - optionally invoice list used by UI.

### GET `/customers/{id}/ledger/print`
- **Purpose**: returns document payload for print.
- **Reads**: customer ledger union (invoices/payments/returns).
- **Output**: print-ready structure (frontend converts to PDF/print).

---

## 6F) Products (`handlers/products/*`) + Rich search

### GET `/products`
- **Inputs**: search, sort, pagination.
- **Reads**: products + manufacturer join as needed.

### POST `/products`, PUT `/products/{id}`, DELETE `/products/{id}`, POST `/products/bulk-delete`
- **Validations**: name/code uniqueness; deletion safety.

### GET `/products/check-code`, GET `/products/check-name`
- **Purpose**: inline uniqueness checks for UI forms.

### GET `/products/rich-search`
- **Purpose**: retailer billing/product picker UX.
- **Reads**:
  - product name/code/drug_name fuzzy matches
  - best in-stock batches
  - supplier context
- **Output**: results suitable for “pick product + batch quickly”.

---

## 6G) Product batches / Quality Master (`handlers/productBatches/*`)

### GET `/api/product-batches`
- **Inputs**: productId, stock filters, search, pagination.
- **Reads**: product_batches + derived computed stock and expiry status.

### GET `/api/product-batches/{id}`
- **Reads**: batch row + computed totals.

### POST `/api/product-batches`
- **Validations**:
  - batch_no required
  - expiry date valid, mfg date valid if present
  - pricing fields non-negative and GST slab valid
- **Writes**:
  - batch record
  - OPENING inventory txn if opening stock provided

### PUT `/api/product-batches/{id}`
- **Validations**:
  - opening stock cannot be edited after any non-opening txn exists
- **Writes**:
  - batch updates
  - special path: delete+reinsert OPENING txn (allowed only when safe)

### PATCH `/product-batches/{id}/loose-stock`
- **Purpose**: set loose stock (retailer).
- **Writes**:
  - update loose_stock fields
  - insert ADJUSTMENT note txn for traceability

### DELETE `/api/product-batches/{id}`, POST `/api/product-batches/bulk-delete`
- **Validations**: referenced by invoices/txns; soft-delete behavior.

---

## 6H) Purchase invoices (`handlers/purchaseInvoices/*`)

### GET `/purchase-invoices`
- **Inputs**:
  - `search`, `status`, `paymentStatus`, `vendorId`/`divisionId`
  - `dateFrom/dateTo` (normalized)
  - sort fields (safe allowlist)
  - pagination
- **Reads**: purchase_invoices + vendor/division joins as required.
- **Output**: `{ items, pagination }`.

### POST `/purchase-invoices` (Create DRAFT)
- **Validations**:
  - invoice_date is valid and not future (clientToday used to avoid timezone mismatch)
  - vendor or division selected
  - line items required and valid (qty > 0, rates, gst slab)
- **Writes**:
  - purchase_invoices status DRAFT
  - purchase_invoice_items inserted
- **Output**: created invoice + items summary.

### PUT `/purchase-invoices/{id}` (Update)
Two modes:

#### 1) Update DRAFT invoice
- Allowed only when status is DRAFT.
- Replaces header + all line items.
- Recalculates totals.
- Updates invoice balance_due using amount_paid.

#### 2) Edit CONFIRMED invoice (explicit, controlled)
- Allowed only when:
  - status is CONFIRMED
  - request includes explicit flag enabling confirmed edit
  - no confirmed purchase returns exist for this invoice
- Steps:
  - Load old items; group by batch → old qty/free
  - Validate new items; group by batch → new qty/free
  - Compute **delta** per batch (new-old).
  - For any negative delta: ensure resulting batch stock won’t go below 0 (stock already sold/consumed).
  - Insert `inventory_txns` ADJUSTMENT rows per affected batch (qty/free deltas).
  - If pricing fields changed: write `batch_price_history` + update batch pricing/derived fields.
  - Replace purchase_invoice_items set with new items.
  - Refresh invoice payment summary to keep balance/payment_status correct.

### POST `/purchase-invoices/{id}/confirm`
- Allowed only when status is DRAFT.
- Steps:
  - Lock invoice row (FOR UPDATE).
  - Validate manufacturer policy locks if linked to division/mfg.
  - For each item:
    - resolve batch by id or by (product+batch_no), or create new batch
    - if pricing differs: insert batch_price_history + update batch derived pricing fields
    - stamp batch vendor/division
    - insert inventory_txns PURCHASE with qty/free
  - Mark invoice CONFIRMED.
  - Auto-apply vendor ON_ACCOUNT advances to reduce balance_due (if vendor has advance rows).
  - Refresh payment summary.
  - Update supplier_products mapping.

### POST `/purchase-invoices/{id}/cancel` + bulk cancel
- Draft: mark cancelled.
- Confirmed: insert compensating ledger moves (reversal logic) and update status.

### POST `/purchase-invoices/{id}/delete`
- Soft delete, typically restricted to non-confirmed or cancelled depending on rule.

### POST `/purchase-invoices/bulk-confirm`
- Confirms multiple drafts; returns per-id outcomes.

---

## 6I) Purchase returns (`handlers/purchaseReturns/*`)

### POST `/purchase-returns` (create draft)
- Validations:
  - invoice link exists (or freehand if schema allows)
  - line item quantities and batch references are valid
- Writes: return header + return items as draft.

### POST `/purchase-returns/{id}/confirm`
- Validations: status is DRAFT.
- Writes:
  - inventory_txns PURCHASE_RETURN (negative) to reduce stock
  - mark return CONFIRMED
  - update related invoice summaries as needed (depends on implementation).

---

## 6J) Supplier payments (`handlers/vendorPayments/*`, `handlers/divisionPayments/*`)

### GET `/vendor-payments` / GET `/division-payments`
- Filters: search, partyId, invoiceId, allocationType, paymentMode, date range.
- Outputs items + pagination.

### POST `/vendor-payments` / POST `/division-payments`
- Supports:
  - **INVOICE** allocation: linked to purchase_invoice_id
  - **ON_ACCOUNT** allocation: purchase_invoice_id NULL (advance)
- Validations:
  - amount > 0
  - payment_mode allowed
  - vendor/division exists
- Writes: payment row; refresh invoice payment summary if invoice-linked.

### POST `/vendor-payments/bulk-settle` / `/division-payments/bulk-settle`
- Creates settlements for many invoices and updates their payment summaries.

---

## 6K) Sales invoices / billing (`handlers/salesInvoices/*`)

### GET `/sales-invoices`
- Filters: search, status, payment_status, customerId, date range, pagination.

### POST `/sales-invoices` (Create DRAFT)
- Validations:
  - customer exists (or walk-in flags)
  - lines valid (qty, rates, GST)
- Writes: draft invoice + line items.

### PUT `/sales-invoices/{id}` (Update DRAFT)
- Allowed only for DRAFT.
- Replaces header + items; recalculates totals.

### POST `/sales-invoices/{id}/confirm`
- Allowed only for DRAFT.
- Validations:
  - If TAX_INVOICE and not walk-in: customer GSTIN required.
  - Stock availability validations occur during txn posting.
- Writes/side effects:
  - Update sales_invoice_items amounts and GST split fields.
  - Insert inventory_txns SALE (negative qty/free).
  - Retailer loose logic:
    - if loose needed: BREAK_PACK txns + update loose_stock
    - insert LOOSE_SALE txns + decrement loose_stock
  - Mark invoice CONFIRMED and set payment_status/amount_paid/balance_due depending on cash/credit behavior.

### Cancel flows
- POST `/sales-invoices/{id}/cancel` and bulk cancel:
  - Insert compensating inventory txns
  - Update invoice status and payment fields.

### Draft helpers (rate/discount/scheme)
- PATCH rate type, PATCH global discount, POST scheme override:
  - modify draft item pricing rules and totals.

### Printing and email
- GET print endpoints return document payload.
- Send-email builds HTML and uses mail module to deliver.

### Barcode lookup
- GET by-barcode helps quick lookup and workflows.

---

## 6L) Sales returns (`handlers/salesReturns/*`)

### GET `/sales-returns`
- Filters: search, status, customerId, date range, pagination.

### POST `/sales-returns` (Create DRAFT)
- Two paths:
  - invoice-linked return (validates max returnable)
  - manual return (retailer-friendly)
- Writes: draft return header + items.

### POST `/sales-returns/{id}/confirm`
- Inserts inventory_txns SALE_RETURN (adds stock back).
- Marks return confirmed.
- Updates related invoice balances if required by accounting rules.

### POST `/sales-returns/{id}/cancel`
- Cancels draft or confirmed depending on rules and inserts compensating txns if needed.

---

## 6M) Customer payments (`handlers/customerPayments/*`)

### GET `/customer-payments`
- Filters: customerId, invoiceId, paymentMode, date range, search.
- Retailer: commonly excludes walk-in payments by default.

### POST `/customer-payments`
- Supports:
  - payment against invoice
  - on-account advance receipts (sales_invoice_id NULL)
- Validations:
  - amount > 0
  - payment_mode allowed
  - walk-in cannot hold advances (policy)
- Writes: payment row; refresh invoice summary for invoice-linked payment.

### POST `/customer-payments/bulk-settle`
- Allocate payments across multiple invoices (and/or apply advances).

---

## 6N) Prescriptions (`handlers/prescriptions/*`)

### GET `/prescriptions`
- Filters: date range, doctor name, search string.
- Uses IST-safe date fallback for created_at when prescription_date missing.

### GET `/prescriptions/{id}`
- Returns full prescription + any linked invoice metadata.

---

## 6O) Reports (`handlers/reports/*`)

### GET `/reports/day-book`
- Input: date (defaults to IST-local “today” if missing).
- Reads:
  - confirmed sales invoices totals by walk-in vs credit
  - customer receipts totals
  - supplier payments totals
  - opening cash from account_settings
- Outputs: receipts/payments/cash_position computed summary.

### GET `/reports/non-moving`
- Input: threshold days (defaults from account_settings).
- Reads:
  - last SALE txn per batch
  - batches with stock where last sale older than threshold or never sold
- Outputs: list sorted by days since last sale and stock.

### GET `/reports/product-supplier`
- Input: text q and/or productId.
- Outputs:
  - product list
  - supplier list derived from mapping and purchase confirmations
  - batch list with supplier inference.

### GET `/reports/mfg-stockist`
- Input: manufacturer query.
- Outputs: manufacturers and stockists derived from:
  - supplier_products
  - vendor_manufacturers
  - confirmed purchases

---

## 6P) Dashboard alerts (`handlers/dashboard/*`)

### GET `/dashboard/alerts`
- Produces alert items (non-moving etc).
- Near-expiry report/ticker logic removed per project changes.

---

## 6Q) Notifications (`handlers/notifications/*`)

### GET `/notifications`, GET `/notifications/unread-count`
- Reads notification inbox for account/user.

### POST `/notifications/mark-read`
- Marks one or many notifications as read.

### POST `/notifications/broadcast`
- Admin/privileged: create broadcast notification to users in tenant.

### Scheduled digest `/notifications/dailyDigest`
- Runs cron; generates daily low-stock notifications.

---

## 6R) Imports (`handlers/import/*`)

### POST `/import/parse`
- Reads uploaded file content (CSV/XLSX), detects headers, produces preview rows.

### POST `/import/validate`
- Validates rows: types, required columns, duplicates, referential integrity.
- Produces a validation report (errors/warnings per row).

### POST `/import/execute`
- Executes import:
  - writes import_job record
  - inserts/updates target rows
  - maintains import_source columns for traceability
  - for batches: may write OPENING txns or update batch fields as allowed

### GET `/import/jobs`, GET `/import/jobs/{id}`
- Lists import jobs and status + results.

### GET `/import/template-meta`
- Provides template specs for UI download/help.

---

## 6S) Uploads (`handlers/uploads/presign`)
- Creates pre-signed upload URLs for storage.
- Validates auth and allowed file parameters.

---

## 7) Standard status models (state machines)

### 7.1 Purchase invoice status
- DRAFT → CONFIRMED → (optional) CANCELLED
- Delete usually allowed only in limited states (draft/cancelled).

### 7.2 Sales invoice status
- DRAFT → CONFIRMED → (optional) CANCELLED
- Cancel inserts ledger reversal to preserve immutability.

### 7.3 Payment status (invoices)
- UNPAID / PARTIAL / PAID derived from totals vs paid.
- Updated whenever payments/returns/confirmed edits affect totals.

---

## 8) Common validation & error behavior

### 8.1 Validation errors (400)
- Missing required fields
- Invalid date formats / future-date rules
- Qty/rate negative or zero where not allowed
- GST slab outside allowed values

### 8.2 State errors (400)
- Editing or confirming wrong status (e.g., confirm non-draft)
- Editing confirmed invoice when returns already confirmed

### 8.3 Business rule errors (400)
- Stock would go negative due to edits or sales
- Manufacturer purchase locks (policy guard)

### 8.4 Not found (404)
- Record doesn’t exist in tenant scope, or soft-deleted.

### 8.5 Duplicate conflicts (409)
- Invoice number duplicate, role name duplicate, etc.

---

## 9) Quick “module dependency” summary

- **Sales confirm** depends on: products, batches, inventory ledger, customers, settings.
- **Purchase confirm** depends on: products, batches, inventory ledger, vendors/divisions, mfg policy, supplier_products map.
- **Payments** depend on: invoices + payment tables + summary refresh helper.
- **Ledgers** depend on: invoices + payments + returns union queries.
- **Reports** depend on: invoices/payments/txns and settings.
- **Imports** depend on: nearly all masters and consistent validation/merge rules.

---

## 10) What to document next (optional appendix)
If you want an even more “controller-by-controller” section for all ~147 handlers:
- I can generate an Appendix listing **each handler file** and:
  - exact permission gate
  - exact query/body schema
  - error codes used
  - side effects
  - related DB tables

Tell me “include appendix” and I’ll add it.

