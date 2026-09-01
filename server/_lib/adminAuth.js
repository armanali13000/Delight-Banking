import { getDb, requireUser, serverTimestamp } from "./firebaseAdmin.js";
import { ADMIN_PERMISSIONS, isValidAdminRole, permissionsForRole } from "./adminPermissions.js";

function authError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function serializeDate(value) {
  return value?.toDate ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value || null;
}

export function safeAdmin(admin) {
  return {
    uid: admin.uid,
    email: admin.email || "",
    displayName: admin.displayName || admin.email || "Administrator",
    photoURL: admin.photoURL || "",
    businessPhone: admin.businessPhone || "",
    provider: admin.provider || "unknown",
    emailVerified: admin.emailVerified ?? null,
    role: admin.role,
    status: admin.status,
    permissions: admin.permissions || [],
    createdAt: serializeDate(admin.createdAt),
    updatedAt: serializeDate(admin.updatedAt),
    lastAdminAccessAt: serializeDate(admin.lastAdminAccessAt)
  };
}

export async function requireAdmin(req, options = {}) {
  const decoded = await requireUser(req);
  const role = decoded.adminRole;
  if (decoded.admin !== true || !isValidAdminRole(role)) {
    throw authError(403, "This account does not have administrative access.");
  }

  const db = getDb();
  const adminRef = db.collection("adminUsers").doc(decoded.uid);
  const adminSnap = await adminRef.get();
  if (!adminSnap.exists) {
    throw authError(403, "This account does not have administrative access.");
  }

  const record = adminSnap.data();
  if (record.status !== "active") {
    throw authError(403, "This administrator account is not active.");
  }
  if (record.role !== role || !isValidAdminRole(record.role)) {
    throw authError(403, "This account does not have administrative access.");
  }

  const admin = safeAdmin({
    uid: decoded.uid,
    email: decoded.email || record.email || "",
    displayName: record.displayName || decoded.name || decoded.email || "Administrator",
    photoURL: record.photoURL || decoded.picture || "",
    businessPhone: record.businessPhone || "",
    provider: record.provider || decoded.firebase?.sign_in_provider || "unknown",
    emailVerified: decoded.email_verified ?? null,
    role: record.role,
    status: record.status,
    permissions: permissionsForRole(record.role, record.permissions || []),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastAdminAccessAt: record.lastAdminAccessAt
  });

  if (options.touchAccess !== false) {
    await adminRef.set({ lastAdminAccessAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  }

  return admin;
}

export function hasPermission(admin, permission) {
  return admin?.role === "super_admin" || Boolean(admin?.permissions?.includes(permission));
}

export async function requireAdminRole(req, allowedRoles) {
  const admin = await requireAdmin(req);
  if (!allowedRoles.includes(admin.role)) {
    throw authError(403, "This administrator role cannot access this area.");
  }
  return admin;
}

export async function requireSuperAdmin(req) {
  return requireAdminRole(req, ["super_admin"]);
}

export async function requirePermission(req, permission) {
  const admin = await requireAdmin(req);
  if (!hasPermission(admin, permission)) {
    throw authError(403, "This administrator role cannot access this area.");
  }
  return admin;
}

export async function writeAdminActivityLog({ admin, action, entityType, entityId, safeMetadata = {} }) {
  if (!admin?.uid || !action || !entityType) {
    const error = new Error("Activity log details are incomplete.");
    error.statusCode = 500;
    throw error;
  }
  const sanitized = JSON.parse(JSON.stringify(safeMetadata || {}));
  await getDb().collection("adminActivityLogs").add({
    adminUid: admin.uid,
    adminEmail: admin.email || "",
    adminRole: admin.role || "",
    action,
    entityType,
    entityId: entityId || "",
    safeMetadata: sanitized,
    createdAt: serverTimestamp()
  });
}

export { ADMIN_PERMISSIONS };
