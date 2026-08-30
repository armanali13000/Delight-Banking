import { requireAdmin, writeAdminActivityLog } from "../_lib/adminAuth.js";
import { handleError, method, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const admin = await requireAdmin(req);
    if (req.query?.logAccess === "1") {
      await writeAdminActivityLog({ admin, action: "admin.session.access", entityType: "adminUser", entityId: admin.uid, safeMetadata: { route: "/api/admin/me" } });
    }
    sendJson(res, 200, { admin });
  } catch (error) {
    handleError(res, error);
  }
}
