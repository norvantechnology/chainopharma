/**
 * Seed fake product_batches (+ OPENING stock) for every product that has none.
 * Also tops up batches that currently have zero billable stock.
 *
 * Usage: node scripts/seed-product-batches.js
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

function loadDotEnvFileSync(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadDotEnvFileSync(path.join(__dirname, "..", ".env"));

function cfnTag(name) {
  return ["scalar", "sequence", "mapping"].map(
    (kind) =>
      new yaml.Type(`!${name}`, {
        kind,
        construct(data) {
          const obj = {};
          obj[`Fn::${name}`] = data;
          return obj;
        }
      })
  );
}
const cfnNames = [
  "Ref", "Condition", "FindInMap", "GetAtt", "GetAZs", "ImportValue",
  "Join", "Select", "Split", "Sub", "Transform", "And", "Equals",
  "If", "Not", "Or", "Base64", "Cidr", "ToJsonString"
];
const CFN_SCHEMA = yaml.DEFAULT_SCHEMA.extend(cfnNames.flatMap(cfnTag));
const STAGE = process.env.STAGE || "local";
const tpl = yaml.load(fs.readFileSync(path.join(__dirname, "..", "template.yaml"), "utf8"), { schema: CFN_SCHEMA });
const stageConfig = tpl.Mappings.StageConfig[STAGE];
if (!stageConfig) {
  console.error(`Stage "${STAGE}" not found in template.yaml`);
  process.exit(1);
}
function envPreferProcess(key, fallback) {
  const a = String(process.env[key] || "").trim();
  if (a) return a;
  return String(fallback ?? "").trim();
}
process.env.DB_HOST = envPreferProcess("DB_HOST", stageConfig.DbHost);
process.env.DB_PORT = envPreferProcess("DB_PORT", stageConfig.DbPort);
process.env.DB_NAME = envPreferProcess("DB_NAME", stageConfig.DbName);
process.env.DB_USER = envPreferProcess("DB_USER", stageConfig.DbUser);
process.env.DB_PASSWORD = envPreferProcess("DB_PASSWORD", stageConfig.DbPassword);
process.env.DB_SSL = envPreferProcess("DB_SSL", stageConfig.DbSsl);

const { query } = require("../src/shared/db");

function money(n, digits = 2) {
  return Math.round(Number(n) * 10 ** digits) / 10 ** digits;
}

function fakeRates(seed) {
  const mrp = money(50 + (seed % 40) * 12.5);
  const purchase = money(mrp * 0.55);
  const sales = money(mrp * 0.75);
  return { mrp, purchase, sales, retail: sales };
}

function expiryYmd(monthsAhead) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const products = await query(
    `
    SELECT p.id, p.account_id, p.code, p.name, p.drug_name, p.division_id, p.mfg_company_id,
           p.sales_gst, p.purchase_gst, p.packing, p.bulk_pack, p.case_pack,
           p.sales_scheme, p.scheme_qty_paid, p.scheme_qty_free,
           p.stockable, p.conversion_unit, p.is_discount_enabled, p.is_half_scheme, p.is_control
    FROM products p
    WHERE p.deleted_at IS NULL
    ORDER BY p.account_id, p.created_at
    `
  );

  let created = 0;
  let topped = 0;

  for (const p of products.rows || []) {
    const existing = await query(
      `
      SELECT pb.id,
             COALESCE((
               SELECT SUM(COALESCE(it.qty, 0)) FROM inventory_txns it
               WHERE it.account_id = pb.account_id AND it.batch_id = pb.id
             ), 0)::numeric AS stock_qty
      FROM product_batches pb
      WHERE pb.account_id = $1 AND pb.product_id = $2 AND pb.deleted_at IS NULL
      ORDER BY pb.created_at ASC
      `,
      [p.account_id, p.id]
    );
    const batches = existing.rows || [];

    if (!batches.length) {
      const seed = Number(String(p.id).replace(/\D/g, "").slice(-6) || "1");
      const rates = fakeRates(seed);
      const stock = 25 + (seed % 76);
      const freeQty = seed % 3 === 0 ? 2 : 0;
      const loose = seed % 5;
      const batchNo = `FAKE-${String(seed).slice(-4)}-${String(created + 1).padStart(3, "0")}`;
      const actorId = p.account_id || null;

      const ins = await query(
        `
        INSERT INTO product_batches (
          account_id, product_id, vendor_id, division_id,
          product_code, product_name, drug_name, batch_no, barcode,
          expiry_date, mfg_date,
          mrp, purchase_rate, sales_rate, retail_rate, net_rate, landing_cost,
          sales_scheme, scheme_qty_paid, scheme_qty_free, sales_gst, purchase_gst,
          opening_stock, open_stock_free_qty, stockable, conversion_unit,
          packing, bulk_pack, case_pack, packing_units,
          is_discount_enabled, is_hold, is_half_scheme, is_net, is_non_editable_free_qty, is_control,
          low_stock_alert_enabled, low_stock_threshold,
          loose_stock, loose_unit_name, created_by_user_id
        ) VALUES (
          $1,$2,NULL,$3,
          $4,$5,$6,$7,$8,
          $9::date,$10::date,
          $11,$12,$13,$14,$13,$12,
          $15,$16,$17,$18,$19,
          $20,$21,COALESCE($22,true),$23,
          $24,$25,$26,10,
          COALESCE($27,true),false,COALESCE($28,false),false,false,COALESCE($29,false),
          false,0,
          $30,'TAB',$31
        )
        RETURNING id
        `,
        [
          p.account_id,
          p.id,
          p.division_id || null,
          p.code || null,
          p.name,
          p.drug_name || null,
          batchNo,
          `BC${seed}`,
          expiryYmd(14 + (seed % 18)),
          expiryYmd(-(6 + (seed % 8))),
          rates.mrp,
          rates.purchase,
          rates.sales,
          rates.retail,
          p.sales_scheme || null,
          p.scheme_qty_paid || null,
          p.scheme_qty_free || null,
          p.sales_gst ?? 12,
          p.purchase_gst ?? 12,
          stock,
          freeQty,
          p.stockable,
          p.conversion_unit || null,
          p.packing || null,
          p.bulk_pack || null,
          p.case_pack || null,
          p.is_discount_enabled,
          p.is_half_scheme,
          p.is_control,
          loose,
          actorId
        ]
      );
      const batchId = ins.rows[0].id;
      await query(
        `
        INSERT INTO inventory_txns (account_id, batch_id, txn_type, qty, free_qty, note, created_by_user_id)
        VALUES ($1, $2, 'OPENING', $3, $4, $5, $6)
        `,
        [p.account_id, batchId, stock, freeQty, `Seed fake opening for ${p.name}`, actorId]
      );
      created += 1;
      console.log(`CREATED ${p.name} (${p.code || p.id.slice(0, 8)}) batch=${batchNo} stock=${stock} loose=${loose}`);
      continue;
    }

    for (const b of batches) {
      if (Number(b.stock_qty) > 0) continue;
      const addQty = 50;
      await query(
        `
        INSERT INTO inventory_txns (account_id, batch_id, txn_type, qty, free_qty, note, created_by_user_id)
        VALUES ($1, $2, 'OPENING', $3, 0, $4, $5)
        `,
        [p.account_id, b.id, addQty, `Seed top-up opening for ${p.name}`, p.account_id || null]
      );
      await query(
        `
        UPDATE product_batches
        SET opening_stock = COALESCE(opening_stock, 0) + $3,
            packing_units = COALESCE(packing_units, 10),
            loose_unit_name = COALESCE(NULLIF(loose_unit_name, ''), 'TAB'),
            updated_at = now()
        WHERE id = $1 AND account_id = $2
        `,
        [b.id, p.account_id, addQty]
      );
      topped += 1;
      console.log(`TOPUP  ${p.name} batch=${b.id.slice(0, 8)} +${addQty}`);
    }
  }

  console.log(JSON.stringify({ products: (products.rows || []).length, created, topped }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
