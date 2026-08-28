import { requireUser } from "../_lib/firebaseAdmin.js";
import { handleError, method, readJson, sendJson } from "../_lib/http.js";
import { verifyAndRecordPayment } from "../_lib/payments.js";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    const result = await verifyAndRecordPayment(user, body);
    sendJson(res, 200, result);
  } catch (error) {
    handleError(res, error);
  }
}
