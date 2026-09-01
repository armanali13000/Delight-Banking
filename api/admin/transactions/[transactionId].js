import { requireAdmin } from "../../_lib/adminAuth.js";
import { handleError, method, sendJson } from "../../_lib/http.js";
import { getTransactionDetail } from "../../_lib/adminOperations.js";

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const admin = await requireAdmin(req);
    sendJson(res, 200, await getTransactionDetail(admin, String(req.query?.transactionId || "")));
  } catch (error) {
    handleError(res, error);
  }
}
