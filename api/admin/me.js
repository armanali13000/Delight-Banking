import { hasPermission, requireAdmin, writeAdminActivityLog } from "../_lib/adminAuth.js";
import { getAdminDashboardOverview } from "../_lib/adminDashboard.js";
import { handleError, method, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const admin = await requireAdmin(req);
    if (req.query?.logAccess === "1") {
      await writeAdminActivityLog({ admin, action: "admin.session.access", entityType: "adminUser", entityId: admin.uid, safeMetadata: { route: "/api/admin/me" } });
    }
    if (req.query?.dashboard === "overview") {
      if (!hasPermission(admin, "admin.dashboard.view")) {
        const error = new Error("This administrator role cannot access dashboard analytics.");
        error.statusCode = 403;
        throw error;
      }
      sendJson(res, 200, { admin, dashboard: await getAdminDashboardOverview(req.query) });
      return;
    }
    sendJson(res, 200, { admin });
  } catch (error) {
    handleError(res, error);
  }
}