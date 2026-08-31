export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function method(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));
    sendJson(res, 405, { error: "Method not allowed" });
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

export function handleError(res, error) {
  const status = error.statusCode || 500;
  const message = error.safeMessage || (status >= 500 ? "Server could not complete the request." : error.message);
  const code = error.code || error.safeCode || (status >= 500 ? "SERVER_CONFIGURATION_OR_FIREBASE_ERROR" : "REQUEST_FAILED");
  if (status >= 500) console.error("API request failed", { status, code, message });
  sendJson(res, status, { error: message, code, status });
}