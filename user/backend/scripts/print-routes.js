#!/usr/bin/env node
/** Print routes that local-server.js would register (no listen). */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

function cfnTag(name) {
  return ["scalar", "sequence", "mapping"].map(
    (kind) =>
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
  "Ref", "Condition", "FindInMap", "GetAtt", "GetAZs", "ImportValue",
  "Join", "Select", "Split", "Sub", "Transform", "And", "Equals",
  "If", "Not", "Or", "Base64", "Cidr", "ToJsonString"
];
const CFN_SCHEMA = yaml.DEFAULT_SCHEMA.extend(cfnNames.flatMap(cfnTag));

const root = path.join(__dirname, "..");
const tpl = yaml.load(fs.readFileSync(path.join(root, "template.yaml"), "utf8"), { schema: CFN_SCHEMA });
const routes = [];

for (const [logicalId, resource] of Object.entries(tpl.Resources)) {
  if (resource.Type !== "AWS::Serverless::Function") continue;
  const props = resource.Properties || {};
  const handlerStr = props.Handler;
  if (!handlerStr) continue;
  for (const evt of Object.values(props.Events || {})) {
    if (evt.Type !== "Api") continue;
    const apiPath = String(evt.Properties.Path || "").replace(/\{([^}]+)\}/g, ":$1");
    const method = evt.Properties.Method.toLowerCase();
    const idx = handlerStr.lastIndexOf(".");
    routes.push({
      logicalId,
      method,
      apiPath,
      modulePath: handlerStr.substring(0, idx),
      fnName: handlerStr.substring(idx + 1)
    });
  }
}

routes.sort((a, b) => a.method.localeCompare(b.method) || a.apiPath.localeCompare(b.apiPath));

let skipped = 0;
for (const route of routes) {
  if (!route.apiPath.includes("purchase-return")) continue;
  try {
    const mod = require(path.join(root, route.modulePath));
    const handler = mod[route.fnName];
    if (typeof handler !== "function") {
      console.log(`SKIP ${route.method.toUpperCase()} ${route.apiPath} handler not found`);
      skipped++;
      continue;
    }
    console.log(`${route.method.toUpperCase().padEnd(6)} ${route.apiPath}  →  ${route.modulePath}.${route.fnName}`);
  } catch (e) {
    console.log(`SKIP ${route.method.toUpperCase()} ${route.apiPath} ${e.message}`);
    skipped++;
  }
}

if (skipped) process.exit(1);
