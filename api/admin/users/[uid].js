import { requireAdmin } from "../../_lib/adminAuth.js";
import { handleError, method, sendJson } from "../../_lib/http.js";
import { getUserDetail, readBody, updateUserProfile } from "../../_lib/adminOperations.js";

export default async function handler(req, res) {
  if (!method(req, res, ["GET", "PATCH"])) return;
  try {
    const admin = await requireAdmin(req);
    const uid = String(req.query?.uid || "").trim();
    sendJson(res, 200, req.method === "GET" ? await getUserDetail(admin, uid) : await updateUserProfile(admin, uid, await readBody(req)));
  } catch (error) {
    handleError(res, error);
  }
}
