import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getDb, requireUser, serverTimestamp } from "./firebaseAdmin.js";
import { requireSuperAdmin } from "./adminAuth.js";
import { isLimitedAdminRole, permissionsForRole } from "./adminPermissions.js";

const RECENT_AUTH_SECONDS = 15 * 60;
const searchAttempts = new Map();

function appAuth() {
  return getAuth(getAdminApp());
}

function adminError(statusCode, message, safeMessage = message, code = "") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.safeMessage = safeMessage;
  if (code) error.code = code;
  return error;
}

function cleanText(value, max = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function serializeDate(value) {
  return value?.toDate ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value || null;
}

function sanitizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function safeProvider(user) {
  const ids = (user.providerData || []).map((item) => item.providerId).filter(Boolean);
  if (!ids.length) return "password";
  return ids.includes("google.com") ? "google.com" : ids[0];
}

function safeFirebaseUser(user, adminRecord = null) {
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email || "Delight Banking user",
    emailVerified: Boolean(user.emailVerified),
    disabled: Boolean(user.disabled),
    provider: safeProvider(user),
    createdAt: user.metadata?.creationTime || null,
    lastSignInAt: user.metadata?.lastSignInTime || null,
    adminStatus: adminRecord?.status || null,
    adminRole: adminRecord?.role || null
  };
}

export function safeAdminManagementRecord(id, data = {}, firebaseUser = null) {
  return {
    uid: data.uid || id,
    email: data.email || firebaseUser?.email || "",
    displayName: data.displayName || firebaseUser?.displayName || data.email || "Administrator",
    role: data.role || "admin",
    status: data.status || "active",
    permissions: permissionsForRole(data.role, data.permissions || []),
    provider: data.provider || (firebaseUser ? safeProvider(firebaseUser) : "not_available"),
    emailVerified: firebaseUser ? Boolean(firebaseUser.emailVerified) : null,
    disabled: firebaseUser ? Boolean(firebaseUser.disabled) : null,
    createdBy: data.createdBy || "",
    createdByEmail: data.createdByEmail || "",
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    lastAdminAccessAt: serializeDate(data.lastAdminAccessAt),
    suspendedAt: serializeDate(data.suspendedAt),
    suspendedBy: data.suspendedBy || "",
    suspensionReason: data.suspensionReason || "",
    reactivatedAt: serializeDate(data.reactivatedAt),
    reactivatedBy: data.reactivatedBy || "",
    revokedAt: serializeDate(data.revokedAt),
    revokedBy: data.revokedBy || "",
    revocationReason: data.revocationReason || ""
  };
}

export async function requireRecentSuperAdmin(req) {
  const admin = await requireSuperAdmin(req);
  const decoded = await requireUser(req);
  const authTime = Number(decoded.auth_time || 0);
  const age = Math.floor(Date.now() / 1000) - authTime;
  if (!authTime || age > RECENT_AUTH_SECONDS) {
    throw adminError(403, "Recent super-admin authentication is required.", "Recent authentication is required.", "RECENT_LOGIN_REQUIRED");
  }
  return admin;
}

export function validateLimitedRole(role) {
  const value = cleanText(role, 40);
  if (!isLimitedAdminRole(value)) {
    throw adminError(400, "Choose Admin, Support, or Content Manager. Super Admin cannot be assigned here.", "Choose Admin, Support, or Content Manager. Super Admin cannot be assigned here.", "INVALID_ADMIN_ROLE");
  }
  return value;
}

function checkSearchRate(req, admin) {
  const key = `${admin.uid}:${req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "local"}`;
  const now = Date.now();
  const recent = (searchAttempts.get(key) || []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 10) throw adminError(429, "Too many searches. Please wait a minute and try again.");
  recent.push(now);
  searchAttempts.set(key, recent);
}

async function getAdminRecord(uid) {
  const snap = await getDb().collection("adminUsers").doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function assertActiveSuperAdminRemains(targetUid) {
  const snap = await getDb().collection("adminUsers").where("role", "==", "super_admin").where("status", "==", "active").get();
  const activeOthers = snap.docs.some((doc) => doc.id !== targetUid);
  if (!activeOthers) throw adminError(400, "The final active super-admin cannot be removed or suspended.");
}

function assertCanModifyTarget(actor, target, operation) {
  if (!target) throw adminError(404, "Administrator was not found.");
  if (target.uid === actor.uid && ["role_change", "suspend", "revoke"].includes(operation)) {
    throw adminError(400, "You cannot change, suspend, or revoke your own super-admin access.");
  }
  if (target.role === "super_admin" && operation === "role_change") {
    throw adminError(400, "Super-admin role cannot be changed in this interface.");
  }
}

async function writeManagementLog({ admin, action, target, previousRole, newRole, previousStatus, newStatus, reason = "", notificationStatus = "not_configured" }) {
  await getDb().collection("adminActivityLogs").add({
    adminUid: admin.uid,
    adminEmail: admin.email || "",
    adminRole: admin.role || "super_admin",
    actingAdminUid: admin.uid,
    actingAdminEmail: admin.email || "",
    actingAdminRole: admin.role || "super_admin",
    action,
    entityType: "adminUser",
    entityId: target?.uid || "",
    targetUid: target?.uid || "",
    targetEmail: target?.email || "",
    previousRole: previousRole || "",
    newRole: newRole || "",
    previousStatus: previousStatus || "",
    newStatus: newStatus || "",
    reason: cleanText(reason, 500),
    notificationStatus,
    safeMetadata: {
      targetUid: target?.uid || "",
      targetEmail: target?.email || "",
      previousRole: previousRole || "",
      newRole: newRole || "",
      previousStatus: previousStatus || "",
      newStatus: newStatus || "",
      reason: cleanText(reason, 500),
      notificationStatus
    },
    createdAt: serverTimestamp()
  });
}

async function setAdminClaims(uid, role) {
  const auth = appAuth();
  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims || {}) };
  if (role) {
    claims.admin = true;
    claims.adminRole = role;
  } else {
    delete claims.admin;
    delete claims.adminRole;
  }
  await auth.setCustomUserClaims(uid, claims);
  await auth.revokeRefreshTokens(uid);
  return user.customClaims || {};
}

async function restoreClaims(uid, previousClaims) {
  try {
    await appAuth().setCustomUserClaims(uid, previousClaims || null);
    await appAuth().revokeRefreshTokens(uid);
  } catch (cause) {
    console.error("Admin claim rollback failed", { uid, code: cause.code || "unknown" });
  }
}
async function restoreAdminRecord(ref, previousData) {
  try {
    if (previousData) await ref.set(previousData);
    else await ref.delete();
  } catch (cause) {
    console.error("Admin record rollback failed", { code: cause.code || "unknown" });
  }
}

export async function searchVerifiedUserByEmail(req, email) {
  const admin = await requireSuperAdmin(req);
  checkSearchRate(req, admin);
  const normalized = sanitizeEmail(email);
  if (!normalized || !normalized.includes("@")) throw adminError(400, "Enter the exact account email address.");
  let user;
  try {
    user = await appAuth().getUserByEmail(normalized);
  } catch {
    throw adminError(404, "No Firebase Authentication user was found for that exact email address.");
  }
  const adminRecord = await getAdminRecord(user.uid);
  return { user: safeFirebaseUser(user, adminRecord) };
}

export async function listAdministrators(req) {
  await requireSuperAdmin(req);
  const db = getDb();
  const snap = await db.collection("adminUsers").orderBy("createdAt", "desc").limit(250).get();
  const admins = await Promise.all(snap.docs.map(async (doc) => {
    let user = null;
    try { user = await appAuth().getUser(doc.id); } catch {}
    return safeAdminManagementRecord(doc.id, doc.data(), user);
  }));
  return { administrators: admins };
}

export async function getAdministratorDetail(req, uid) {
  await requireSuperAdmin(req);
  const db = getDb();
  const record = await getAdminRecord(uid);
  if (!record) throw adminError(404, "Administrator was not found.");
  let user = null;
  try { user = await appAuth().getUser(uid); } catch {}
  const logsSnap = await db.collection("adminActivityLogs").where("targetUid", "==", uid).limit(25).get();
  const activity = logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: serializeDate(doc.data().createdAt) }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return { administrator: safeAdminManagementRecord(uid, record, user), activity };
}

export async function promoteAdministrator(req, body) {
  const admin = await requireRecentSuperAdmin(req);
  const role = validateLimitedRole(body.role);
  const targetUid = cleanText(body.uid, 128);
  const confirmation = cleanText(body.confirmation, 40);
  if (!targetUid) throw adminError(400, "Target Firebase UID is required.", "Select a verified user before granting administrator access.", "TARGET_UID_REQUIRED");
  if (confirmation !== "ADD ADMIN") throw adminError(400, "Type ADD ADMIN to confirm administrator promotion.", "Type ADD ADMIN to confirm administrator promotion.", "CONFIRMATION_REQUIRED");

  let user;
  try {
    user = await appAuth().getUser(targetUid);
  } catch {
    throw adminError(404, "Target Firebase user was not found.", "Target Firebase user was not found.", "TARGET_USER_NOT_FOUND");
  }

  if (!user.emailVerified) throw adminError(400, "Only verified email accounts can be promoted.", "This email must be verified first.", "TARGET_EMAIL_UNVERIFIED");
  if (user.disabled) throw adminError(400, "Disabled Firebase Authentication accounts cannot be promoted.", "This account is disabled.", "TARGET_ACCOUNT_DISABLED");

  const db = getDb();
  const ref = db.collection("adminUsers").doc(user.uid);
  const existingSnap = await ref.get();
  const existing = existingSnap.exists ? { id: existingSnap.id, ...existingSnap.data() } : null;
  if (existing?.status === "active") throw adminError(409, "This user is already an active administrator.", "This user is already an administrator.", "ADMIN_ALREADY_ACTIVE");
  if (existing?.role === "super_admin") throw adminError(409, "Super-admin records cannot be modified here.", "Super-admin records cannot be modified here.", "SUPER_ADMIN_NOT_ASSIGNABLE");

  const previousClaims = user.customClaims || null;
  const previousRecord = existingSnap.exists ? existingSnap.data() : null;
  let wroteRecord = false;

  try {
    await setAdminClaims(user.uid, role);
    await ref.set({
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email || "Administrator",
      role,
      status: "active",
      permissions: permissionsForRole(role),
      provider: safeProvider(user),
      createdBy: admin.uid,
      createdByEmail: admin.email || "",
      createdAt: existing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      suspendedAt: null,
      suspendedBy: "",
      suspensionReason: "",
      reactivatedAt: existing?.status === "suspended" ? serverTimestamp() : existing?.reactivatedAt || null,
      reactivatedBy: existing?.status === "suspended" ? admin.uid : existing?.reactivatedBy || "",
      revokedAt: null,
      revokedBy: "",
      revocationReason: ""
    }, { merge: true });
    wroteRecord = true;

    await writeManagementLog({ admin, action: "admin.administrator.promoted", target: { uid: user.uid, email: user.email || "" }, previousRole: existing?.role || "", newRole: role, previousStatus: existing?.status || "", newStatus: "active" });

    const [verifiedUser, savedSnap] = await Promise.all([appAuth().getUser(user.uid), ref.get()]);
    const saved = savedSnap.data() || {};
    if (verifiedUser.customClaims?.admin !== true || verifiedUser.customClaims?.adminRole !== role || !savedSnap.exists || saved.role !== role || saved.status !== "active") {
      throw adminError(500, "Administrator promotion verification failed.", "Administrator access could not be granted. Check the server logs.", "ADMIN_PROMOTION_VERIFY_FAILED");
    }

    return {
      administrator: safeAdminManagementRecord(user.uid, saved, verifiedUser),
      message: `Administrator access granted successfully. Role: ${roleLabelForMessage(role)}. The new administrator must sign out and sign in again.`,
      claimsVerified: true,
      firestoreVerified: true
    };
  } catch (cause) {
    await restoreClaims(user.uid, previousClaims);
    if (wroteRecord) await restoreAdminRecord(ref, previousRecord);
    if (cause.statusCode) throw cause;
    throw adminError(500, "Could not complete administrator promotion.", "Administrator access could not be granted. Check the server logs.", "ADMIN_PROMOTION_FAILED");
  }
}

function roleLabelForMessage(role) {
  return role === "content_manager" ? "Content Manager" : role === "support" ? "Support" : "Admin";
}
export async function updateAdministratorRole(req, uid, body) {
  const admin = await requireRecentSuperAdmin(req);
  const role = validateLimitedRole(body.role);
  const reason = cleanText(body.reason, 500);
  if (reason.length < 3) throw adminError(400, "A reason is required.");
  const record = await getAdminRecord(uid);
  assertCanModifyTarget(admin, record, "role_change");
  if (!isLimitedAdminRole(record.role)) throw adminError(400, "Only limited administrator roles can be changed here.");
  if (record.status === "revoked") throw adminError(400, "Revoked administrators cannot be changed. Promote the verified user again if appropriate.");
  if (record.role === role) throw adminError(400, "Choose a different role.");
  const user = await appAuth().getUser(uid).catch(() => null);
  if (user?.disabled) throw adminError(400, "Disabled Firebase Authentication accounts cannot receive administrator changes.");
  const ref = getDb().collection("adminUsers").doc(uid);
  const previousClaims = await setAdminClaims(uid, role);
  try {
    await ref.set({ role, permissions: permissionsForRole(role), updatedAt: serverTimestamp() }, { merge: true });
  } catch (cause) {
    await restoreClaims(uid, previousClaims);
    throw adminError(500, "Could not save administrator role.", "Role change could not be completed. No success was recorded.");
  }
  await writeManagementLog({ admin, action: "admin.administrator.role_changed", target: record, previousRole: record.role, newRole: role, previousStatus: record.status, newStatus: record.status, reason });
  return { administrator: safeAdminManagementRecord(uid, (await ref.get()).data(), user), message: "Administrator role changed. The user must sign out and sign in again." };
}

export async function suspendAdministrator(req, uid, body) {
  const admin = await requireRecentSuperAdmin(req);
  const reason = cleanText(body.reason, 500);
  if (reason.length < 3) throw adminError(400, "A suspension reason is required.");
  const record = await getAdminRecord(uid);
  assertCanModifyTarget(admin, record, "suspend");
  if (record.role === "super_admin") await assertActiveSuperAdminRemains(uid);
  if (record.status !== "active") throw adminError(400, "Only active administrators can be suspended.");
  const previousClaims = await setAdminClaims(uid, null);
  const ref = getDb().collection("adminUsers").doc(uid);
  try {
    await ref.set({ status: "suspended", suspendedAt: serverTimestamp(), suspendedBy: admin.uid, suspensionReason: reason, updatedAt: serverTimestamp() }, { merge: true });
  } catch (cause) {
    await restoreClaims(uid, previousClaims);
    throw adminError(500, "Could not suspend administrator.", "Suspension could not be completed. No success was recorded.");
  }
  await writeManagementLog({ admin, action: "admin.administrator.suspended", target: record, previousRole: record.role, newRole: record.role, previousStatus: record.status, newStatus: "suspended", reason });
  return { administrator: safeAdminManagementRecord(uid, (await ref.get()).data()), message: "Administrative access has been suspended. The user must sign out and sign in again." };
}

export async function reactivateAdministrator(req, uid, body = {}) {
  const admin = await requireRecentSuperAdmin(req);
  const reason = cleanText(body.reason, 500);
  const record = await getAdminRecord(uid);
  assertCanModifyTarget(admin, record, "reactivate");
  if (record.status === "revoked") throw adminError(400, "Revoked administrators cannot be reactivated.");
  if (record.status !== "suspended") throw adminError(400, "Only suspended administrators can be reactivated.");
  if (record.role !== "super_admin" && !isLimitedAdminRole(record.role)) throw adminError(400, "Administrator role is invalid.");
  const user = await appAuth().getUser(uid).catch(() => null);
  if (user?.disabled) throw adminError(400, "Disabled Firebase Authentication accounts cannot be reactivated.");
  const previousClaims = await setAdminClaims(uid, record.role);
  const ref = getDb().collection("adminUsers").doc(uid);
  try {
    await ref.set({ status: "active", reactivatedAt: serverTimestamp(), reactivatedBy: admin.uid, updatedAt: serverTimestamp() }, { merge: true });
  } catch (cause) {
    await restoreClaims(uid, previousClaims);
    throw adminError(500, "Could not reactivate administrator.", "Reactivation could not be completed. No success was recorded.");
  }
  await writeManagementLog({ admin, action: "admin.administrator.reactivated", target: record, previousRole: record.role, newRole: record.role, previousStatus: record.status, newStatus: "active", reason });
  return { administrator: safeAdminManagementRecord(uid, (await ref.get()).data(), user), message: "Administrative access has been reactivated. The user must sign out and sign in again." };
}

export async function revokeAdministrator(req, uid, body) {
  const admin = await requireRecentSuperAdmin(req);
  const reason = cleanText(body.reason, 500);
  const confirmation = cleanText(body.confirmation, 40);
  if (confirmation !== "REVOKE ADMIN") throw adminError(400, "Type REVOKE ADMIN to confirm revocation.");
  if (reason.length < 3) throw adminError(400, "A revocation reason is required.");
  const record = await getAdminRecord(uid);
  assertCanModifyTarget(admin, record, "revoke");
  if (record.role === "super_admin") await assertActiveSuperAdminRemains(uid);
  if (record.status === "revoked") throw adminError(400, "Administrator access is already revoked.");
  const previousClaims = await setAdminClaims(uid, null);
  const ref = getDb().collection("adminUsers").doc(uid);
  try {
    await ref.set({ status: "revoked", revokedAt: serverTimestamp(), revokedBy: admin.uid, revocationReason: reason, updatedAt: serverTimestamp() }, { merge: true });
  } catch (cause) {
    await restoreClaims(uid, previousClaims);
    throw adminError(500, "Could not revoke administrator.", "Revocation could not be completed. No success was recorded.");
  }
  await writeManagementLog({ admin, action: "admin.administrator.revoked", target: record, previousRole: record.role, newRole: record.role, previousStatus: record.status, newStatus: "revoked", reason });
  return { administrator: safeAdminManagementRecord(uid, (await ref.get()).data()), message: "Administrative access has been revoked. The user keeps their normal Delight Banking account." };
}