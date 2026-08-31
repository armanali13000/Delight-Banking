import { requireSuperAdmin } from "../../_lib/adminAuth.js";
import { listAdministrators } from "../../_lib/adminManagement.js";
import { handleError, method, sendJson } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    await requireSuperAdmin(req);
    sendJson(res, 200, await listAdministrators(req));
  } catch (error) {
    handleError(res, error);
  }
}