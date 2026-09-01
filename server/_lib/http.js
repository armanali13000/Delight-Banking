import crypto from "node:crypto";

function requestId() {
  return crypto.randomBytes(8).toString("hex");
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function method(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));
    sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed.", requestId: requestId() } });
    return false;
  }
  return true;
}

export async function readJson(req) {
  try {
    if (req.body && typeof req.body === "object") return req.body;
    if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (!chunks.length) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (cause) {
    const error = new Error("Malformed JSON request body.");
    error.statusCode = 400;
    error.code = "MALFORMED_JSON";
    error.cause = cause;
    throw error;
  }
}

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function codeFor(status, error) {
  if (error.code || error.safeCode) return error.code || error.safeCode;
  if (status === 400) return "INVALID_REQUEST";
  if (status === 401) return "AUTHENTICATION_REQUIRED";
  if (status === 403) return "PERMISSION_DENIED";
  if (status === 404) return "NOT_FOUND";
  if (status === 405) return "METHOD_NOT_ALLOWED";
  return "SERVER_ERROR";
}

export function handleError(res, error) {
  const status = error.statusCode || 500;
  const id = requestId();
  const message = error.safeMessage || (status >= 500 ? "Server could not complete the request." : error.message);
  const code = codeFor(status, error);
  if (status >= 500) console.error("API request failed", { requestId: id, status, code, message, stack: error.stack });
  sendJson(res, status, { ok: false, error: { code, message, requestId: id }, code, status });
}
