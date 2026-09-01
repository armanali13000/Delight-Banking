import { requireAdmin } from "../../_lib/adminAuth.js";
import { handleError, method, sendJson } from "../../_lib/http.js";
import { grantSubscription, readBody } from "../../_lib/adminOperations.js";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const admin = await requireAdmin(req);
    sendJson(res, 200, await grantSubscription(admin, await readBody(req)));
  } catch (error) {
    handleError(res, error);
  }
}
