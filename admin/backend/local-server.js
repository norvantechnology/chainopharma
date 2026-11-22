const fs = require("fs");
const yaml = require("js-yaml");
const express = require("express");
const cors = require("cors");
const path = require("path");

const STAGE = process.env.STAGE || "local";
const PORT = Number(process.env.PORT || 4005);

function cfnTag(name) {
  return ["scalar", "sequence", "mapping"].map((kind) =>
    new yaml.Type("!" + name, {
      kind,
      construct(data) {
        const obj = {};
        obj["Fn::" + name] = data;
        return obj;
      }
    })
  );
}

const cfnNames = [
  "Ref",
  "Condition",
  "FindInMap",
  "GetAtt",
  "GetAZs",
  "ImportValue",
  "Join",
  "Select",
  "Split",
  "Sub",
  "Transform",
  "And",
  "Equals",
  "If",
  "Not",
  "Or",
  "Base64",
  "Cidr",
  "ToJsonString"
];
const CFN_SCHEMA = yaml.DEFAULT_SCHEMA.extend(cfnNames.flatMap(cfnTag));

const tpl = yaml.load(fs.readFileSync(path.join(__dirname, "template.yaml"), "utf8"), { schema: CFN_SCHEMA });
const stageConfig = tpl.Mappings.StageConfig[STAGE];
if (!stageConfig) {
  console.error(`Stage "${STAGE}" not found in template.yaml Mappings.StageConfig`);
  process.exit(1);
}

process.env.STAGE = STAGE;
process.env.PANEL = "admin";
process.env.APP_NAME = stageConfig.AppName;
process.env.DB_HOST = stageConfig.DbHost;
process.env.DB_PORT = stageConfig.DbPort;
process.env.DB_NAME = stageConfig.DbName;
process.env.DB_USER = stageConfig.DbUser;
process.env.DB_PASSWORD = stageConfig.DbPassword;
process.env.DB_SSL = stageConfig.DbSsl;
process.env.BCRYPT_COST = stageConfig.BcryptCost;
process.env.JWT_ACCESS_SECRET = stageConfig.JwtAccessSecret;
process.env.ACCESS_TOKEN_TTL_SECONDS = stageConfig.AccessTokenTtlSeconds;
process.env.REFRESH_TOKEN_TTL_SECONDS = stageConfig.RefreshTokenTtlSeconds;
process.env.REFRESH_TOKEN_TTL_REMEMBER_SECONDS = stageConfig.RefreshTokenTtlRememberSeconds;

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

const app = express();
app.use(cors());
app.use(express.json());

for (const route of routes) {
  const mod = require(path.join(__dirname, route.modulePath));
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
      queryStringParameters: req.query,
      body: req.body ? JSON.stringify(req.body) : null,
      isBase64Encoded: false,
      requestContext: { stage: STAGE }
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
      res.status(500).json({ ok: false, data: null, meta: null, error: { code: "INTERNAL", message: "Internal server error" } });
    }
  });

  console.log(`  ${route.method.toUpperCase().padEnd(6)} ${route.apiPath}  →  ${route.modulePath}.${route.fnName}`);
}

app.listen(PORT, () => {
  console.log(`\nLocal dev server running → http://localhost:${PORT}  (stage: ${STAGE})\n`);
});

