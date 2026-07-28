// raw-body-middleware.js
// Must be registered BEFORE express.json() in webhook-server.js
// Saves the raw body buffer so VAPI signature validation can use it

const { json, urlencoded } = require("express");

function rawBodyMiddleware(req, res, next) {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => { data += chunk; });
  req.on("end", () => {
    req.rawBody = data;
    // Now parse JSON manually so the rest of the app still gets req.body
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch {
      req.body = {};
    }
    next();
  });
}

module.exports = { rawBodyMiddleware };
