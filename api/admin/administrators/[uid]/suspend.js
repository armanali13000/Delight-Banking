import { requireSuperAdmin } from "../../_lib/adminAuth.js";
import { suspendAdministrator } from "../../../../_lib/adminManagement.js";
import { handleError, method, readJson, sendJson } from "../../../../_lib/http.js";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    await requireSuperAdmin(req);
    sendJson(res, 200, await suspendAdministrator(req, req.query.uid, await readJson(req)));
  } catch (error) {
    handleError(res, error);
  }
}