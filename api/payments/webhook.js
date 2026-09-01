import crypto from "node:crypto";
import { method, readRawBody, sendJson } from "../../server/_lib/http.js";
import { getCashfreeMode } from "../../server/_lib/cashfree.js";
import { processWebhookEvent } from "../../server/_lib/payments.js";

export const config = {
  api: {
    bodyParser: false
  }
};

function hasHeader(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function verifySignature(rawBodyString, timestamp, signature) {
  if (!hasHeader(signature) || !hasHeader(timestamp) || !process.env.CASHFREE_CLIENT_SECRET) return false;
  const signedPayload = timestamp + rawBodyString;
  const computedSignature = crypto
    .createHmac("sha256", process.env.CASHFREE_CLIENT_SECRET)
    .update(signedPayload)
    .digest("base64");
  const computed = Buffer.from(computedSignature);
  const supplied = Buffer.from(signature);
  return computed.length === supplied.length && crypto.timingSafeEqual(computed, supplied);
}

function logWebhookDiagnostic(details) {
  console.info("Cashfree webhook diagnostic", {
    hasSignatureHeader: details.hasSignatureHeader,
    hasTimestampHeader: details.hasTimestampHeader,
    eventType: details.eventType || null,
    signatureValid: details.signatureValid,
    testOrUnsupported: details.testOrUnsupported,
    environment: getCashfreeMode()
  });
}

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;

  const rawBody = await readRawBody(req);
  const rawBodyString = rawBody.toString("utf8");
  const signature = req.headers["x-webhook-signature"];
  const timestamp = req.headers["x-webhook-timestamp"];
  const hasSignatureHeader = hasHeader(signature);
  const hasTimestampHeader = hasHeader(timestamp);

  if (!hasSignatureHeader) {
    logWebhookDiagnostic({ hasSignatureHeader, hasTimestampHeader, signatureValid: false, testOrUnsupported: false });
    sendJson(res, 400, { error: "Missing webhook signature" });
    return;
  }

  if (!hasTimestampHeader) {
    logWebhookDiagnostic({ hasSignatureHeader, hasTimestampHeader, signatureValid: false, testOrUnsupported: false });
    sendJson(res, 400, { error: "Missing webhook timestamp" });
    return;
  }

  const signatureValid = verifySignature(rawBodyString, String(timestamp), String(signature));
  if (!signatureValid) {
    logWebhookDiagnostic({ hasSignatureHeader, hasTimestampHeader, signatureValid: false, testOrUnsupported: false });
    sendJson(res, 400, { error: "Invalid webhook signature" });
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBodyString);
  } catch {
    logWebhookDiagnostic({ hasSignatureHeader, hasTimestampHeader, signatureValid: true, testOrUnsupported: false });
    sendJson(res, 400, { error: "Malformed webhook payload" });
    return;
  }

  try {
    const result = await processWebhookEvent(event, rawBodyString);
    logWebhookDiagnostic({
      hasSignatureHeader,
      hasTimestampHeader,
      eventType: event.type || event.event,
      signatureValid: true,
      testOrUnsupported: Boolean(result.reason === "test_or_unsupported_event" || result.reason === "unknown_order" || result.duplicate)
    });
    sendJson(res, 200, result);
  } catch (error) {
    console.error("Cashfree webhook processing failed", {
      eventType: event?.type || event?.event || null,
      environment: getCashfreeMode(),
      message: error.message
    });
    logWebhookDiagnostic({
      hasSignatureHeader,
      hasTimestampHeader,
      eventType: event?.type || event?.event,
      signatureValid: true,
      testOrUnsupported: true
    });
    sendJson(res, 200, { received: true, processed: false, reason: "test_or_unsupported_event" });
  }
}

