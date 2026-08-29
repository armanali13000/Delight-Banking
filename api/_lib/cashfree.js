import crypto from "node:crypto";

const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2025-01-01";

export function getCashfreeMode() {
  return String(process.env.CASHFREE_ENVIRONMENT || process.env.CASHFREE_MODE || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
}

function getBaseUrl() {
  return getCashfreeMode() === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

function getCredentials() {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const error = new Error("Payment gateway credentials are not configured.");
    error.statusCode = 500;
    error.safeMessage = "Payment gateway credentials are not configured. Check CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET in Vercel.";
    throw error;
  }
  return { clientId, clientSecret };
}

async function cashfreeRequest(path, options = {}) {
  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-api-version": CASHFREE_API_VERSION,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || data.error_description || data.error || `Payment gateway request failed with ${response.status}.`;
    const error = new Error(message);
    error.statusCode = response.status >= 500 ? 502 : 400;
    error.safeMessage = message;
    error.gatewayResponse = data;
    throw error;
  }
  return data;
}

export async function createCashfreeOrder(payload) {
  return cashfreeRequest("/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchCashfreeOrder(orderId) {
  return cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`);
}

export async function fetchCashfreePayments(orderId) {
  return cashfreeRequest(`/orders/${encodeURIComponent(orderId)}/payments`).catch(() => []);
}

export function verifyCashfreeWebhookSignature(rawBody, timestamp, signature) {
  if (!process.env.CASHFREE_CLIENT_SECRET || !timestamp || !signature) return false;
  const signedPayload = `${timestamp}${Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "")}`;
  const expected = crypto.createHmac("sha256", process.env.CASHFREE_CLIENT_SECRET).update(signedPayload).digest("base64");
  const actual = Buffer.from(String(signature));
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
}
