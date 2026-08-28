import { requireUser } from "../../_lib/firebaseAdmin.js";
import { handleError, method, sendJson } from "../../_lib/http.js";
import { getUserPaymentSummary } from "../../_lib/payments.js";

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const user = await requireUser(req);
    const result = await getUserPaymentSummary(user);
    sendJson(res, 200, result);
  } catch (error) {
    handleError(res, error);
  }
}
