const fs = require("fs");
const yaml = require("js-yaml");
const express = require("express");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const { buildOpenApi, buildServers } = require("./src/swagger/buildOpenApi");

/** Load `user/backend/.env` before template.yaml so SMTP_* etc. apply without committing secrets. */
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
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // ignore missing or unreadable .env
  }
}

loadDotEnvFileSync(path.join(__dirname, ".env"));

const STAGE = process.env.STAGE || "local";
const PORT = Number(process.env.PORT || 4000);

function jsonFromNodeError(err) {
  const c = err && typeof err === "object" ? String(err.code || "") : "";
  if (
    c === "EAI_AGAIN" ||
    c === "ENOTFOUND" ||
    c === "ECONNREFUSED" ||
    c === "ETIMEDOUT" ||
    c === "ESOCKETTIMEDOUT"
  ) {
    return {
      status: 503,
      payload: {
        ok: false,
        data: null,
        meta: null,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Database temporarily unavailable.",
          subMessage: "Check your network connection and try again.",
          details: null
        }
      }
    };
  }
  return null;
}

function cfnTag(name) {
  return ["scalar", "sequence", "mapping"].map((kind) =>
    new yaml.Type("!" + name, {
      kind,
      construct(data) {
        const obj = {};
        obj["Fn::" + name] = data;
        return obj;
      },
    })
  );
}

const cfnNames = [
  "Ref", "Condition", "FindInMap", "GetAtt", "GetAZs", "ImportValue",
  "Join", "Select", "Split", "Sub", "Transform", "And", "Equals",
  "If", "Not", "Or", "Base64", "Cidr", "ToJsonString",
];
const CFN_SCHEMA = yaml.DEFAULT_SCHEMA.extend(cfnNames.flatMap(cfnTag));

const tpl = yaml.load(
  fs.readFileSync(path.join(__dirname, "template.yaml"), "utf8"),
  { schema: CFN_SCHEMA }
);

const stageConfig = tpl.Mappings.StageConfig[STAGE];
if (!stageConfig) {
  console.error(`Stage "${STAGE}" not found in template.yaml Mappings.StageConfig`);
  process.exit(1);
}

process.env.STAGE = STAGE;
process.env.PANEL = "user";
process.env.APP_NAME = stageConfig.AppName;
process.env.APP_BRAND_NAME = String(stageConfig.BrandDisplayName ?? "").trim() || "Chaino Pharma";
function envPreferProcess(key, fallback) {
  const a = String(process.env[key] || "").trim();
  if (a) return a;
  return String(fallback ?? "").trim();
}

// Prefer .env / process DB_* so local Docker DB can override StageConfig (e.g. when Supabase is down).
process.env.DB_HOST = envPreferProcess("DB_HOST", stageConfig.DbHost);
process.env.DB_PORT = envPreferProcess("DB_PORT", stageConfig.DbPort);
process.env.DB_NAME = envPreferProcess("DB_NAME", stageConfig.DbName);
process.env.DB_USER = envPreferProcess("DB_USER", stageConfig.DbUser);
process.env.DB_PASSWORD = envPreferProcess("DB_PASSWORD", stageConfig.DbPassword);
process.env.DB_SSL = envPreferProcess("DB_SSL", stageConfig.DbSsl);
process.env.BCRYPT_COST = stageConfig.BcryptCost;
process.env.JWT_ACCESS_SECRET = stageConfig.JwtAccessSecret;
process.env.ACCESS_TOKEN_TTL_SECONDS = stageConfig.AccessTokenTtlSeconds;
process.env.REFRESH_TOKEN_TTL_SECONDS = stageConfig.RefreshTokenTtlSeconds;
process.env.REFRESH_TOKEN_TTL_REMEMBER_SECONDS = stageConfig.RefreshTokenTtlRememberSeconds;

process.env.S3_BUCKET = envPreferProcess("S3_BUCKET", stageConfig.S3Bucket);
process.env.S3_REGION = envPreferProcess("S3_REGION", stageConfig.S3Region);
if (!String(process.env.AWS_REGION || "").trim() && process.env.S3_REGION) {
  process.env.AWS_REGION = process.env.S3_REGION;
}
process.env.SMTP_HOST = envPreferProcess("SMTP_HOST", stageConfig.SmtpHost ?? "");
process.env.SMTP_PORT = envPreferProcess("SMTP_PORT", stageConfig.SmtpPort ?? "587");
process.env.SMTP_SECURE = envPreferProcess("SMTP_SECURE", stageConfig.SmtpSecure ?? "0");
process.env.SMTP_USER = envPreferProcess("SMTP_USER", stageConfig.SmtpUser ?? "");
process.env.SMTP_PASS = envPreferProcess("SMTP_PASS", stageConfig.SmtpPass ?? "");
process.env.SMTP_FROM = envPreferProcess("SMTP_FROM", stageConfig.SmtpFrom ?? "");
process.env.EMAIL_VERIFY_OTP_TTL_MINUTES = String(stageConfig.EmailVerifyOtpTtlMinutes ?? "15");
process.env.PASSWORD_RESET_OTP_TTL_MINUTES = String(stageConfig.PasswordResetOtpTtlMinutes ?? "15");
process.env.MEDICO_EMAIL_DRY_RUN = envPreferProcess("MEDICO_EMAIL_DRY_RUN", stageConfig.MedicoEmailDryRun ?? "").trim();

const routes = [];
for (const [logicalId, resource] of Object.entries(tpl.Resources)) {
  if (resource.Type !== "AWS::Serverless::Function") continue;
  const props = resource.Properties || {};
  const handlerStr = props.Handler;
  if (!handlerStr) continue;

  const events = props.Events || {};
  for (const evt of Object.values(events)) {
    if (evt.Type !== "Api") continue;
    const apiPath = String(evt.Properties.Path || "").replace(/\{([^}]+)\}/g, ":$1");
    const method = evt.Properties.Method.toLowerCase();
    const idx = handlerStr.lastIndexOf(".");
    const modulePath = handlerStr.substring(0, idx);
    const fnName = handlerStr.substring(idx + 1);
    routes.push({ logicalId, method, apiPath, modulePath, fnName });
  }
}

function routePriorityScore(route) {
  const parts = String(route.apiPath || "").split("/").filter(Boolean);
  const staticCount = parts.filter((p) => !p.startsWith(":")).length;
  const paramCount = parts.length - staticCount;
  return {
    staticCount,
    paramCount,
    depth: parts.length
  };
}

routes.sort((a, b) => {
  // Keep HTTP methods grouped for predictable Express matching.
  if (a.method !== b.method) return a.method.localeCompare(b.method);
  const pa = routePriorityScore(a);
  const pb = routePriorityScore(b);
  // More static segments first (e.g. /check before /:id).
  if (pa.staticCount !== pb.staticCount) return pb.staticCount - pa.staticCount;
  // Fewer params first.
  if (pa.paramCount !== pb.paramCount) return pa.paramCount - pb.paramCount;
  // Deeper paths first (more specific).
  if (pa.depth !== pb.depth) return pb.depth - pa.depth;
  return a.apiPath.localeCompare(b.apiPath);
});

const app = express();
// DevTunnel / reverse proxies terminate TLS and forward Host + X-Forwarded-*.
app.set("trust proxy", true);

const publicApiUrl = String(
  process.env.PUBLIC_API_URL || process.env.SWAGGER_SERVER_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

function isLocalUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(String(url || ""));
}

function requestBaseUrl(req) {
  const xfProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const proto = xfProto || req.protocol || "http";
  const xfHost = String(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = xfHost || req.get("host") || `localhost:${PORT}`;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

app.use((req, res, next) => {
  // Always mirror back the exact Origin the browser sent.
  // This covers localhost:5173 (frontend dev), DevTunnel, and any other host.
  const origin = String(req.headers.origin || "").trim();
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Disposition, Content-Type"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: "10mb" }));

const openApiSpecBase = buildOpenApi({
  port: PORT,
  stage: STAGE,
  rootDir: __dirname,
  publicApiUrl
});

app.get("/api-docs.json", (req, res) => {
  const spec = {
    ...openApiSpecBase,
    servers: buildServers({
      port: PORT,
      stage: STAGE,
      requestBaseUrl: requestBaseUrl(req),
      publicApiUrl
    })
  };
  res.setHeader("Cache-Control", "no-store");
  res.json(spec);
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(null, {
    customSiteTitle: "Chaino Pharma User API Docs",
    swaggerOptions: {
      // Relative URL → same host as the browser (works with DevTunnel).
      url: "/api-docs.json",
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "none",
      filter: true,
      tryItOutEnabled: true,
      withCredentials: false
    }
  })
);

const swaggerPublicHint = publicApiUrl || `http://localhost:${PORT}`;
console.log(`  Swagger UI → ${swaggerPublicHint}/api-docs`);
console.log(`  OpenAPI JSON → ${swaggerPublicHint}/api-docs.json\n`);

const registeredRoutes = new Set();

function flattenQuery(q) {
  const out = {};
  for (const [k, v] of Object.entries(q || {})) {
    if (Array.isArray(v)) out[k] = v.length ? String(v[v.length - 1]) : "";
    else if (v == null) out[k] = "";
    else out[k] = String(v);
  }
  return out;
}

function multiValueQuery(q) {
  const out = {};
  for (const [k, v] of Object.entries(q || {})) {
    if (Array.isArray(v)) out[k] = v.map((x) => String(x));
    else if (v == null) out[k] = [];
    else out[k] = [String(v)];
  }
  return out;
}

for (const route of routes) {
  let mod;
  try {
    mod = require(path.join(__dirname, route.modulePath));
  } catch (err) {
    console.warn(`  SKIP ${route.method.toUpperCase()} ${route.apiPath}  module load failed: ${err.message}`);
    continue;
  }
  const handler = mod[route.fnName];
  if (typeof handler !== "function") {
    console.warn(`  SKIP ${route.method.toUpperCase()} ${route.apiPath}  handler not found`);
    continue;
  }

  app[route.method](route.apiPath, async (req, res) => {
    const event = {
      httpMethod: req.method,
      path: req.path,
      headers: req.headers,
      queryStringParameters: flattenQuery(req.query),
      multiValueQueryStringParameters: multiValueQuery(req.query),
      pathParameters: req.params || null,
      body: req.body ? JSON.stringify(req.body) : null,
      isBase64Encoded: false,
      requestContext: { stage: STAGE },
    };

    try {
      const result = await handler(event);
      const statusCode = result.statusCode || 200;
      const respHeaders = result.headers || {};
      for (const [k, v] of Object.entries(respHeaders)) {
        res.setHeader(k, v);
      }
      res.status(statusCode).send(result.body || "");
    } catch (err) {
      console.error(`Error in ${route.logicalId}:`, err);
      const mapped = jsonFromNodeError(err);
      if (mapped) {
        res.status(mapped.status).json(mapped.payload);
        return;
      }
      res.status(500).json({
        ok: false,
        data: null,
        meta: null,
        error: {
          code: "INTERNAL",
          message: "Internal server error",
          subMessage: "Please try again.",
          details: null
        }
      });
    }
  });

  console.log(`  ${route.method.toUpperCase().padEnd(6)} ${route.apiPath}  →  ${route.modulePath}.${route.fnName}`);
}

// Optional: serve built user frontend from the same port (public tunnel / low-cost single URL).
const frontendDist = String(process.env.FRONTEND_DIST || "").trim()
  || path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(path.join(frontendDist, "index.html"))) {
  app.use(express.static(frontendDist, { index: false, fallthrough: true }));
  // Express 5 path-to-regexp needs named splat (not "*").
  app.get("/{*spaPath}", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const p = String(req.path || "");
    if (
      p.startsWith("/api-docs") ||
      p === "/hello" ||
      p.startsWith("/auth") ||
      p.startsWith("/access") ||
      p.startsWith("/api/")
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"), (err) => (err ? next() : undefined));
  });
  console.log(`  Serving frontend dist → ${frontendDist}`);
}

app.listen(PORT, () => {
  console.log(`\nLocal dev server running → http://localhost:${PORT}  (stage: ${STAGE})`);
  if (publicApiUrl) {
    console.log(`Public / tunnel URL → ${publicApiUrl}`);
    console.log(`Swagger docs → ${publicApiUrl.replace(/\/+$/, "")}/api-docs`);
  } else {
    console.log(`Swagger docs → http://localhost:${PORT}/api-docs`);
  }
  console.log("");
});
