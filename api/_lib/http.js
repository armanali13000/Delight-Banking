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
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export function handleError(res, error) {
  const status = error.statusCode || 500;
  const message = error.safeMessage || (status >= 500 ? "Server could not complete the request." : error.message);
  if (status >= 500) console.error(error);
  sendJson(res, status, { error: message });
}

