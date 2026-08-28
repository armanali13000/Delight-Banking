import { handleError, method, readRawBody, sendJson } from "../_lib/http.js";
import { processWebhookEvent, verifyWebhookSignature } from "../_lib/payments.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-razorpay-signature"];
    if (!process.env.RAZORPAY_WEBHOOK_SECRET || !verifyWebhookSignature(rawBody, signature)) {
      sendJson(res, 400, { error: "Invalid webhook signature" });
      return;
    }
    const result = await processWebhookEvent(JSON.parse(rawBody.toString("utf8")));
    sendJson(res, 200, result);
  } catch (error) {
    handleError(res, error);
  }
}
