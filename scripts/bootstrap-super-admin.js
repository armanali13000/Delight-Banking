import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getDb, serverTimestamp } from "../api/_lib/firebaseAdmin.js";
import { ADMIN_PERMISSIONS } from "../api/_lib/adminPermissions.js";
import { writeAdminActivityLog } from "../api/_lib/adminAuth.js";

const uid = process.env.BOOTSTRAP_ADMIN_UID?.trim();
const confirmed = process.env.CONFIRM_BOOTSTRAP_SUPER_ADMIN === "yes";

if (!uid) {
  console.error("BOOTSTRAP_ADMIN_UID is required.");
  process.exit(1);
}

const auth = getAuth(getAdminApp());
let user;
try {
  user = await auth.getUser(uid);
} catch {
  console.error("No Firebase Authentication user exists for BOOTSTRAP_ADMIN_UID.");
  process.exit(1);
}

console.log("Target Firebase user:");
console.log(`UID: ${user.uid}`);
console.log(`Email: ${user.email || "not available"}`);

if (!confirmed) {
  console.error("Refusing to continue. Set CONFIRM_BOOTSTRAP_SUPER_ADMIN=yes to confirm this trusted local action.");
  process.exit(1);
}

const claims = { ...(user.customClaims || {}), admin: true, adminRole: "super_admin" };
await auth.setCustomUserClaims(uid, claims);

const adminRecord = {
  uid,
  email: user.email || "",
  displayName: user.displayName || user.email || "Super Admin",
  photoURL: user.photoURL || "",
  role: "super_admin",
  status: "active",
  permissions: Object.values(ADMIN_PERMISSIONS),
  createdBy: "bootstrap-super-admin",
  updatedAt: serverTimestamp(),
  lastAdminAccessAt: null
};

const db = getDb();
const ref = db.collection("adminUsers").doc(uid);
const existing = await ref.get();
await ref.set({ ...adminRecord, createdAt: existing.exists ? existing.data().createdAt : serverTimestamp() }, { merge: true });

await writeAdminActivityLog({
  admin: { uid, email: user.email || "", role: "super_admin" },
  action: existing.exists ? "admin.bootstrap.refresh" : "admin.bootstrap.create",
  entityType: "adminUser",
  entityId: uid,
  safeMetadata: { role: "super_admin", status: "active" }
});

console.log("Super-admin bootstrap complete.");
console.log("Sign out and sign in again so Firebase refreshes the admin custom claims.");
