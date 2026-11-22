const { json } = require("./http");

function ok(data, meta) {
  return json(200, { ok: true, data, meta: meta || null, error: null });
}

function created(data, meta) {
  return json(201, { ok: true, data, meta: meta || null, error: null });
}

function fail(statusCode, code, message, details) {
  return json(statusCode, {
    ok: false,
    data: null,
    meta: null,
    error: {
      code,
      message,
      details: details || null
    }
  });
}

module.exports = { ok, created, fail };

