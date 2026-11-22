const { ok } = require("../shared/response");

async function handler() {
  return ok({
    panel: process.env.PANEL || "admin",
    message: "Hello from medico-admin backend",
    app: process.env.APP_NAME || "medico-admin-backend",
    stage: process.env.STAGE || "local"
  });
}

module.exports = { handler };

