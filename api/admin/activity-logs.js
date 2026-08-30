import { requireAdminRole } from "../_lib/adminAuth.js";
import { getDb } from "../_lib/firebaseAdmin.js";
import { handleError, method, sendJson } from "../_lib/http.js";

function serializeDate(value) {
  return value?.toDate ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value || null;
}

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    await requireAdminRole(req, ["super_admin", "admin"]);
    const limit = Math.min(Math.max(Number(req.query?.limit || 25), 1), 50);
    const snap = await getDb().collection("adminActivityLogs").orderBy("createdAt", "desc").limit(limit).get();
    const logs = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        adminUid: data.adminUid || "",
        adminEmail: data.adminEmail || "",
        adminRole: data.adminRole || "",
        action: data.action || "",
        entityType: data.entityType || "",
        entityId: data.entityId || "",
        safeMetadata: data.safeMetadata || {},
        createdAt: serializeDate(data.createdAt)
      };
    });
    sendJson(res, 200, { logs });
  } catch (error) {
    handleError(res, error);
  }
}
