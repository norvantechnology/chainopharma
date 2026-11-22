/**
 * Build OpenAPI 3.0 document from template.yaml + endpointSpecs.
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const components = require("./components");
const endpointSpecs = require("./endpointSpecs");

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

function tagFromPath(apiPath) {
  const parts = String(apiPath || "").split("/").filter(Boolean);
  if (!parts.length) return "General";
  const first = parts[0] === "api" && parts[1] ? parts[1] : parts[0];
  return first
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function collectRoutes(templatePath) {
  const tpl = yaml.load(fs.readFileSync(templatePath, "utf8"), { schema: CFN_SCHEMA });
  const routes = [];
  for (const [logicalId, resource] of Object.entries(tpl.Resources || {})) {
    if (resource.Type !== "AWS::Serverless::Function") continue;
    const props = resource.Properties || {};
    const handlerStr = props.Handler;
    if (!handlerStr) continue;
    for (const evt of Object.values(props.Events || {})) {
      if (evt.Type !== "Api") continue;
      routes.push({
        logicalId,
        method: String(evt.Properties.Method || "GET").toUpperCase(),
        path: String(evt.Properties.Path || ""),
        handler: handlerStr
      });
    }
  }
  return routes;
}

function pathParams(apiPath) {
  const params = [];
  const re = /\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(apiPath))) {
    params.push({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string", format: m[1] === "id" || m[1].endsWith("Id") ? "uuid" : undefined },
      description: `Path parameter: ${m[1]}`
    });
  }
  return params;
}

function queryParams(queryMap) {
  if (!queryMap) return [];
  return Object.entries(queryMap).map(([name, schema]) => {
    const raw = typeof schema === "object" && schema ? { ...schema } : { type: "string" };
    const description = raw.description;
    delete raw.description;
    const param = {
      name,
      in: "query",
      required: Boolean(raw.required),
      schema: raw
    };
    delete raw.required;
    if (description) param.description = description;
    return param;
  });
}

function autoExampleFromProperties(properties) {
  return Object.fromEntries(
    Object.entries(properties || {}).map(([k, v]) => [
      k,
      v.example !== undefined
        ? v.example
        : v.type === "boolean"
          ? false
          : v.type === "integer" || v.type === "number"
            ? 0
            : v.type === "array"
              ? Array.isArray(v.example)
                ? v.example
                : v.items?.example !== undefined
                  ? [v.items.example]
                  : v.items?.type === "object" && v.items?.properties
                    ? [autoExampleFromProperties(v.items.properties)]
                    : []
              : v.enum
                ? v.enum[0]
                : v.format === "email"
                  ? "user@example.com"
                  : v.format === "uuid"
                    ? "00000000-0000-0000-0000-000000000000"
                    : v.format === "date"
                      ? "2026-07-18"
                      : "string"
    ])
  );
}

function buildRequestBody(spec) {
  if (spec.bodyRef) {
    return {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: `#/components/schemas/${spec.bodyRef}` }
        }
      }
    };
  }
  if (!spec.body) return undefined;
  const jsonContent = {
    schema: {
      type: "object",
      required: spec.body.required || undefined,
      properties: spec.body.properties || {}
    }
  };
  if (spec.body.examples) {
    jsonContent.examples = spec.body.examples;
  } else if (spec.body.example !== undefined) {
    jsonContent.example = spec.body.example;
  } else {
    jsonContent.example = autoExampleFromProperties(spec.body.properties || {});
  }
  return {
    required: true,
    content: {
      "application/json": jsonContent
    }
  };
}

function defaultResponses(spec) {
  if (spec.responses) return spec.responses;
  const successContent =
    spec.produces === "application/pdf"
      ? { "application/pdf": { schema: { type: "string", format: "binary" } } }
      : {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiSuccess" }
          }
        };
  return {
    200: { description: "Success", content: successContent },
    201: {
      description: "Created",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccess" } } }
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
    },
    403: {
      description: "Forbidden",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
    },
    500: {
      description: "Internal error",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
    }
  };
}

function normalizeServerUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function buildServers({ port = 4000, stage = "local", requestBaseUrl, publicApiUrl } = {}) {
  const servers = [];
  const seen = new Set();
  const push = (url, description) => {
    const u = normalizeServerUrl(url);
    if (!u || seen.has(u)) return;
    seen.add(u);
    servers.push({ url: u, description });
  };

  // Prefer the URL the browser is actually using (DevTunnel / reverse proxy).
  push(requestBaseUrl, "Current request host (use this for Try it out)");
  push(publicApiUrl || process.env.PUBLIC_API_URL || process.env.SWAGGER_SERVER_URL, "Public / tunnel API URL");
  push(`http://localhost:${port}`, `Local Express (${stage})`);
  push(`http://127.0.0.1:${port}`, "Local loopback");

  if (!servers.length) {
    push(`http://localhost:${port}`, `Local Express (${stage})`);
  }
  return servers;
}

function buildOpenApi({
  port = 4000,
  stage = "local",
  rootDir,
  requestBaseUrl,
  publicApiUrl,
  servers
} = {}) {
  const root = rootDir || path.join(__dirname, "../..");
  const routes = collectRoutes(path.join(root, "template.yaml"));
  const paths = {};
  const tagSet = new Set();

  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    const spec = endpointSpecs[key] || {};
    const tags = spec.tags || [tagFromPath(route.path)];
    tags.forEach((t) => tagSet.add(t));

    if (!paths[route.path]) paths[route.path] = {};
    const op = {
      tags,
      summary: spec.summary || `${route.method} ${route.path}`,
      description:
        spec.description ||
        `Handler: \`${route.handler}\` · SAM: \`${route.logicalId}\``,
      operationId: route.logicalId,
      parameters: [...pathParams(route.path), ...queryParams(spec.query)],
      responses: defaultResponses(spec)
    };

    if (spec.security === undefined) {
      op.security = [{ BearerAuth: [] }];
    } else if (Array.isArray(spec.security) && spec.security.length === 0) {
      op.security = [];
    } else {
      op.security = spec.security;
    }

    const body = buildRequestBody(spec);
    if (body) op.requestBody = body;

    paths[route.path][route.method.toLowerCase()] = op;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Chaino Pharma User Backend API",
      description: [
        "OpenAPI documentation for the Chaino Pharma User panel backend.",
        "",
        "**Auth:** Most endpoints require `Authorization: Bearer <accessToken>`.",
        "Obtain tokens via `POST /auth/login` or `POST /auth/otp/verify`.",
        "",
        "**Response envelope:** `{ ok, data, meta, error }`",
        "",
        "**Servers:** Pick the DevTunnel / public URL in the server dropdown when sharing Swagger.",
        "",
        `**Stage:** ${stage} · **Routes documented:** ${routes.length}`
      ].join("\n"),
      version: "0.1.0"
    },
    servers:
      Array.isArray(servers) && servers.length
        ? servers
        : buildServers({ port, stage, requestBaseUrl, publicApiUrl }),
    tags: [...tagSet].sort().map((name) => ({ name })),
    paths,
    components
  };
}

module.exports = { buildOpenApi, buildServers, collectRoutes, normalizeServerUrl };
