import { requireSuperAdmin } from "../../_lib/adminAuth.js";
import { getAdministratorDetail, updateAdministratorRole } from "../../_lib/adminManagement.js";
import { handleError, method, readJson, sendJson } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (!method(req, res, ["GET", "PATCH"])) return;
  try {
    await requireSuperAdmin(req);
    const uid = req.query.uid;
    if (req.method === "GET") sendJson(res, 200, await getAdministratorDetail(req, uid));
    else sendJson(res, 200, await updateAdministratorRole(req, uid, await readJson(req)));
  } catch (error) {
    handleError(res, error);
  }
}