const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function signAccessToken({ sub, email }) {
  const secret = process.env.JWT_ACCESS_SECRET || "dev_only_change_me";
  const expiresInSec = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900);
  const token = jwt.sign({ sub, email, role: "ADMIN" }, secret, { expiresIn: expiresInSec });
  return { accessToken: token, accessExpiresInSec: expiresInSec };
}

function verifyAccessToken(token) {
  const secret = process.env.JWT_ACCESS_SECRET || "dev_only_change_me";
  return jwt.verify(String(token || ""), secret);
}

function newRefreshToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = { signAccessToken, verifyAccessToken, newRefreshToken };

