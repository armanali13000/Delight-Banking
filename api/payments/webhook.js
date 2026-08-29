import { handleError, method, readRawBody, sendJson } from "../_lib/http.js";
import { processWebhookEvent, verifyWebhookSignature } from "../_lib/payments.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    if (!verifyWebhookSignature(rawBody, timestamp, signature)) {
      sendJson(res, 400, { error: "Invalid webhook signature" });
      return;
    }
    const rawText = rawBody.toString("utf8");
    let event;
    try {
      event = JSON.parse(rawText);
    } catch {
      sendJson(res, 400, { error: "Malformed webhook payload" });
      return;
    }
    const result = await processWebhookEvent(event, rawText);
    sendJson(res, 200, result);
  } catch (error) {
    handleError(res, error);
  }
}

