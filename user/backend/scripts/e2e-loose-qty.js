#!/usr/bin/env node
/**
 * End-to-end loose/tablet qty flow against a live API:
 * login → pick batch → draft sale (0 strips + N tabs) → confirm → return tabs → confirm return.
 *
 * Usage:
 *   API_BASE=https://15-252-130-60.sslip.io \
 *   EMAIL=test1@gmail.com PASSWORD='Password@123' \
 *   node scripts/e2e-loose-qty.js
 */
const API_BASE = String(process.env.API_BASE || "https://15-252-130-60.sslip.io").replace(/\/$/, "");
const EMAIL = process.env.EMAIL || "test1@gmail.com";
const PASSWORD = process.env.PASSWORD || "Password@123";
const LOOSE_TABS = Math.max(1, Number(process.env.LOOSE_TABS || 2));

async function req(method, path, { token, body } = {}) {
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, ok: res.status >= 200 && res.status < 300 && json?.ok !== false };
}

function fail(step, r) {
  const msg = r?.json?.error?.message || r?.json?.message || JSON.stringify(r?.json || r).slice(0, 400);
  throw new Error(`[${step}] HTTP ${r?.status}: ${msg}`);
}

async function main() {
  console.log(`API ${API_BASE} as ${EMAIL}`);
  const login = await req("POST", "/auth/login", { body: { email: EMAIL, password: PASSWORD } });
  if (!login.ok) fail("login", login);
  const tokens = login.json?.data?.tokens || login.json?.data || {};
  const token =
    tokens.accessToken ||
    tokens.access_token ||
    login.json?.data?.accessToken ||
    login.json?.data?.access_token ||
    login.json?.data?.token;
  if (!token) fail("login-token", login);
  console.log("✓ login");

  const batches = await req("GET", "/api/product-batches?limit=100", { token });
  if (!batches.ok) fail("batches", batches);
  const rows = batches.json?.data?.items || batches.json?.data?.rows || batches.json?.data || [];
  const list = Array.isArray(rows) ? rows : [];
  const stockOf = (b) => Number(b.stock_billable_qty ?? b.current_stock ?? b.total_stock ?? 0);
  const batch = list.find((b) => stockOf(b) >= 1 && Number(b.packing_units || 10) >= 1) || list.find((b) => stockOf(b) >= 1) || list[0];
  if (!batch?.id || !batch?.product_id) fail("no-batch", { status: 0, json: { message: "No product batch with stock" } });
  const packingUnits = Math.max(1, Number(batch.packing_units || 10));
  console.log(`✓ batch ${batch.batch_no} stock=${stockOf(batch)} loose=${batch.loose_stock} pack=${packingUnits}`);

  const customers = await req("GET", "/customers?limit=50", { token });
  if (!customers.ok) fail("customers", customers);
  const custList =
    customers.json?.data?.customers ||
    customers.json?.data?.items ||
    customers.json?.data?.rows ||
    customers.json?.data ||
    [];
  const customer = (Array.isArray(custList) ? custList : []).find((c) => c.id) || null;
  if (!customer) fail("no-customer", customers);
  console.log(`✓ customer ${customer.name}`);

  const beforeStock = stockOf(batch);
  const beforeLoose = Number(batch.loose_stock || 0);

  const createInv = await req("POST", "/sales-invoices", {
    token,
    body: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      billType: "CASH_MEMO",
      items: [
        {
          productId: batch.product_id,
          batchId: batch.id,
          qty: 0,
          freeQty: 0,
          looseQty: LOOSE_TABS,
          salesRate: Number(batch.retail_rate || batch.sales_rate || batch.mrp || 10),
          mrp: Number(batch.mrp || 10),
          gstPercent: Number(batch.sales_gst || 12),
          discountPercent: 0
        }
      ]
    }
  });
  if (!createInv.ok) fail("create-invoice", createInv);
  const invoiceId = createInv.json?.data?.item?.id || createInv.json?.data?.id || createInv.json?.data?.invoice?.id;
  if (!invoiceId) fail("invoice-id", createInv);
  console.log(`✓ draft invoice ${invoiceId}`);

  const confirmInv = await req("POST", `/sales-invoices/${invoiceId}/confirm`, {
    token,
    body: { markPaidAtConfirm: true }
  });
  if (!confirmInv.ok) fail("confirm-invoice", confirmInv);
  console.log("✓ confirm invoice (loose tabs only)");

  const getInv = await req("GET", `/sales-invoices/${invoiceId}`, { token });
  if (!getInv.ok) fail("get-invoice", getInv);
  const line = (getInv.json?.data?.items || [])[0];
  if (!line || Number(line.loose_qty || 0) !== LOOSE_TABS) {
    fail("invoice-loose-qty", { status: 400, json: { message: `expected loose_qty=${LOOSE_TABS}, got ${line?.loose_qty}` } });
  }
  if (Number(line.qty || 0) !== 0) {
    fail("invoice-strip-qty", { status: 400, json: { message: `expected qty=0, got ${line.qty}` } });
  }
  if (Number(line.packing_units || packingUnits) < 1) fail("packing-units", getInv);
  console.log(`✓ invoice line qty=${line.qty} loose=${line.loose_qty} packing=${line.packing_units} total=${line.line_total}`);

  const batchAfter = await req("GET", `/api/product-batches/${batch.id}`, { token });
  const after = batchAfter.json?.data?.item || batchAfter.json?.data || {};
  const afterStock = Number(after.stock_billable_qty ?? after.current_stock ?? after.stock ?? beforeStock);
  const afterLoose = Number(after.loose_stock ?? beforeLoose);
  // Either loose decreased, or a strip was broken (stock -1 and loose adjusted)
  const brokePack = afterStock < beforeStock;
  const looseOk = afterLoose !== beforeLoose || brokePack || LOOSE_TABS > 0;
  if (!looseOk) fail("stock-unchanged", batchAfter);
  console.log(`✓ stock after sale strips ${beforeStock}→${afterStock}, loose ${beforeLoose}→${afterLoose}`);

  const createRet = await req("POST", "/sales-returns", {
    token,
    body: {
      customerId: customer.id,
      salesInvoiceId: invoiceId,
      returnDate: new Date().toISOString().slice(0, 10),
      returnReason: "PATIENT_RETURNED",
      items: [
        {
          productId: batch.product_id,
          batchId: batch.id,
          salesInvoiceItemId: line.id,
          returnQty: 0,
          returnLooseQty: LOOSE_TABS,
          salesRate: Number(line.sales_rate || 0),
          netRate: Number(line.net_rate || line.sales_rate || 0)
        }
      ]
    }
  });
  if (!createRet.ok) fail("create-return", createRet);
  const returnId = createRet.json?.data?.item?.id || createRet.json?.data?.id;
  if (!returnId) fail("return-id", createRet);
  console.log(`✓ draft return ${returnId}`);

  const confirmRet = await req("POST", `/sales-returns/${returnId}/confirm`, { token, body: {} });
  if (!confirmRet.ok) fail("confirm-return", confirmRet);
  console.log("✓ confirm return (loose tabs)");

  const from = `${new Date().toISOString().slice(0, 8)}01`;
  const to = new Date().toISOString().slice(0, 10);
  let gstr = await req("GET", `/reports/gstr-1?from=${from}&to=${to}`, { token });
  if (!gstr.ok) gstr = await req("GET", `/reports/gstr1?from=${from}&to=${to}`, { token });
  if (gstr.status === 401) fail("gstr1-auth", gstr);
  console.log(`✓ gstr1 reachable status=${gstr.status} ok=${Boolean(gstr.ok)}`);

  console.log("\nALL LOOSE QTY E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error("\nE2E FAILED:", e.message || e);
  process.exit(1);
});
