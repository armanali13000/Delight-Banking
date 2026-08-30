import { getDb, serverTimestamp } from "../_lib/firebaseAdmin.js";
import { requireAdmin, safeAdmin, writeAdminActivityLog } from "../_lib/adminAuth.js";
import { handleError, method, readJson, sendJson } from "../_lib/http.js";

function cleanText(value, max = 120) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

export default async function handler(req, res) {
  if (!method(req, res, ["PATCH"])) return;
  try {
    const admin = await requireAdmin(req, { touchAccess: false });
    const body = await readJson(req);
    const displayName = cleanText(body.displayName || admin.displayName);
    const photoURL = String(body.photoURL || admin.photoURL || "").trim().slice(0, 500);
    if (displayName.length < 2) {
      const error = new Error("Display name is required.");
      error.statusCode = 400;
      throw error;
    }
    const db = getDb();
    const ref = db.collection("adminUsers").doc(admin.uid);
    await ref.set({ displayName, photoURL, updatedAt: serverTimestamp() }, { merge: true });
    const updated = await ref.get();
    const nextAdmin = safeAdmin({ uid: admin.uid, email: admin.email, ...updated.data() });
    await writeAdminActivityLog({ admin: nextAdmin, action: "admin.profile.update", entityType: "adminUser", entityId: admin.uid, safeMetadata: { fields: ["displayName", "photoURL"].filter((field) => field in body) } });
    sendJson(res, 200, { admin: nextAdmin });
  } catch (error) {
    handleError(res, error);
  }
}
