import { getDb, serverTimestamp } from "../server/_lib/firebaseAdmin.js";
import { hasPermission, requireAdmin, requireAdminRole, safeAdmin, writeAdminActivityLog } from "../server/_lib/adminAuth.js";
import { getAdminDashboardOverview } from "../server/_lib/adminDashboard.js";
import {
  addAdminNote,
  cancelSubscription,
  exportReport,
  extendSubscription,
  getOrderDetail,
  getSubscriptionDetail,
  getTransactionDetail,
  getUserDetail,
  grantSubscription,
  listOrders,
  listSubscriptions,
  listTransactions,
  listUsers,
  reactivateSubscription,
  readBody,
  reconcileTransaction,
  revokeSubscription,
  searchVerifiedUser,
  updateUserProfile,
  updateUserStatus
} from "../server/_lib/adminOperations.js";
import {
  getAdministratorDetail,
  listAdministrators,
  promoteAdministrator,
  reactivateAdministrator,
  revokeAdministrator,
  suspendAdministrator,
  updateAdministratorRole
} from "../server/_lib/adminManagement.js";
import {
  createUploadSession,
  deleteAdminClass,
  deleteAdminResource,
  deleteAdminTarget,
  duplicateAdminResource,
  getAdminClass,
  getAdminResource,
  getAdminTarget,
  listAdminClasses,
  listAdminResources,
  listAdminTargets,
  saveAdminClass,
  saveAdminResource,
  saveAdminTarget,
  setAdminClassStatus,
  setAdminResourceStatus,
  setAdminTargetStatus
} from "../server/_lib/content.js";
import {
  createPlan,
  deleteUnusedPlan,
  deleteUnusedPlanVariant,
  duplicatePlan,
  getAdminPlan,
  listAdminPlans,
  setPlanStatus,
  setPlanVariantStatus,
  trashPlan,
  updatePlan,
  updatePlanVariant
} from "../server/_lib/planManagement.js";
import { handleError, method, readJson, sendJson } from "../server/_lib/http.js";

const RESOURCES = new Set(["me", "dashboard", "users", "administrators", "subscriptions", "orders", "transactions", "activity_logs", "exports", "plans", "resources", "targets", "classes"]);
const ACTIONS = new Set([
  "update_admin_profile",
  "update_user",
  "update_user_status",
  "promote_administrator",
  "update_administrator",
  "suspend_administrator",
  "reactivate_administrator",
  "revoke_administrator",
  "grant_subscription",
  "extend_subscription",
  "cancel_subscription",
  "revoke_subscription",
  "reactivate_subscription",
  "reconcile_transaction",
  "add_note",
  "save_resource",
  "duplicate_resource",
  "publish_resource",
  "schedule_resource",
  "unpublish_resource",
  "archive_resource",
  "restore_resource",
  "delete_resource",
  "create_upload_session",
  "save_target",
  "publish_target",
  "unpublish_target",
  "archive_target",
  "restore_target",
  "complete_target",
  "delete_target",
  "save_class",
  "publish_class",
  "unpublish_class",
  "cancel_class",
  "record_class",
  "archive_class",
  "restore_class",
  "delete_class",
  "disable_plan_variant",
  "enable_plan_variant",
  "delete_unused_plan_variant",
  "archive_plan_variant",
  "update_plan_variant",
  "create_plan_variant",
  "delete_unused_plan",
  "trash_plan",
  "restore_plan",
  "archive_plan",
  "unpublish_plan",
  "publish_plan",
  "duplicate_plan",
  "update_plan",
  "create_plan"
]);

function cleanText(value, max = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function notFound(message = "Admin API resource was not found.") {
  const error = new Error(message);
  error.statusCode = 404;
  throw error;
}

function queryResource(req) {
  const resource = cleanText(req.query?.resource || "me", 80);
  if (!RESOURCES.has(resource)) badRequest("Invalid admin API resource.");
  return resource;
}

function queryId(req, name = "id") {
  return cleanText(req.query?.[name] || req.query?.id, 240);
}

function sendCsv(res, report) {
  res.statusCode = 200;
  res.setHeader("Content-Type", report.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
  res.end(report.body);
}

async function updateAdminProfile(req, res) {
  const admin = await requireAdmin(req, { touchAccess: false });
  const body = await readJson(req);
  const displayName = cleanText(body.displayName || admin.displayName, 120);
  const photoURL = String(body.photoURL || admin.photoURL || "").trim().slice(0, 500);
  const businessPhone = cleanText(body.businessPhone || admin.businessPhone || "", 30);
  if (displayName.length < 2) badRequest("Display name is required.");
  const db = getDb();
  const ref = db.collection("adminUsers").doc(admin.uid);
  await ref.set({ displayName, photoURL, businessPhone, updatedAt: serverTimestamp() }, { merge: true });
  const updated = await ref.get();
  const nextAdmin = safeAdmin({ uid: admin.uid, email: admin.email, ...updated.data() });
  await writeAdminActivityLog({ admin: nextAdmin, action: "admin.profile.update", entityType: "adminUser", entityId: admin.uid, safeMetadata: { fields: ["displayName", "photoURL", "businessPhone"].filter((field) => field in body) } });
  sendJson(res, 200, { admin: nextAdmin });
}

async function handleGet(req, res, resource) {
  if (resource === "me") {
    const admin = await requireAdmin(req);
    if (req.query?.logAccess === "1") {
      await writeAdminActivityLog({ admin, action: "admin.session.access", entityType: "adminUser", entityId: admin.uid, safeMetadata: { route: "/api/admin" } });
    }
    sendJson(res, 200, { admin });
    return;
  }

  if (resource === "dashboard") {
    const admin = await requireAdmin(req);
    if (!hasPermission(admin, "admin.dashboard.view")) {
      const error = new Error("This administrator role cannot access dashboard analytics.");
      error.statusCode = 403;
      throw error;
    }
    sendJson(res, 200, { admin, dashboard: await getAdminDashboardOverview(req.query) });
    return;
  }

  if (resource === "activity_logs") {
    await requireAdminRole(req, ["super_admin", "admin"]);
    const limit = Math.min(Math.max(Number(req.query?.limit || 25), 1), 50);
    const snap = await getDb().collection("adminActivityLogs").orderBy("createdAt", "desc").limit(limit).get();
    const logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt || null }));
    sendJson(res, 200, { logs });
    return;
  }

  if (resource === "administrators") {
    const uid = queryId(req, "uid");
    sendJson(res, 200, uid ? await getAdministratorDetail(req, uid) : await listAdministrators(req));
    return;
  }

  const admin = await requireAdmin(req);
  if (resource === "users") {
    if (req.query?.search === "1") sendJson(res, 200, await searchVerifiedUser(admin, req.query || {}));
    else {
      const uid = queryId(req, "uid");
      sendJson(res, 200, uid ? await getUserDetail(admin, uid) : await listUsers(admin, req.query || {}));
    }
    return;
  }
  if (resource === "subscriptions") {
    const id = queryId(req, "subscriptionId");
    sendJson(res, 200, id ? await getSubscriptionDetail(admin, id) : await listSubscriptions(admin, req.query || {}));
    return;
  }
  if (resource === "orders") {
    const id = queryId(req, "orderId");
    sendJson(res, 200, id ? await getOrderDetail(admin, id) : await listOrders(admin, req.query || {}));
    return;
  }
  if (resource === "transactions") {
    const id = queryId(req, "transactionId");
    sendJson(res, 200, id ? await getTransactionDetail(admin, id) : await listTransactions(admin, req.query || {}));
    return;
  }
  if (resource === "exports") {
    const type = cleanText(req.query?.type || req.query?.reportType, 80);
    if (!type) badRequest("Export type is required.");
    sendCsv(res, await exportReport(admin, type, req.query || {}));
    return;
  }
  if (resource === "plans") {
    const id = queryId(req, "planId");
    sendJson(res, 200, id ? await getAdminPlan(admin, id) : await listAdminPlans(admin, req.query || {}));
    return;
  }
  if (resource === "resources") {
    const id = queryId(req, "resourceId");
    sendJson(res, 200, id ? await getAdminResource(admin, id) : await listAdminResources(admin, req.query || {}));
    return;
  }
  if (resource === "targets") {
    const id = queryId(req, "targetId");
    sendJson(res, 200, id ? await getAdminTarget(admin, id) : await listAdminTargets(admin, req.query || {}));
    return;
  }
  if (resource === "classes") {
    const id = queryId(req, "classId");
    sendJson(res, 200, id ? await getAdminClass(admin, id) : await listAdminClasses(admin, req.query || {}));
    return;
  }
  notFound();
}

async function handlePatch(req, res, resource) {
  if (resource === "users") {
    const admin = await requireAdmin(req);
    const uid = queryId(req, "uid");
    if (!uid) badRequest("User id is required.");
    sendJson(res, 200, await updateUserProfile(admin, uid, await readBody(req)));
    return;
  }
  if (resource === "administrators") {
    const uid = queryId(req, "uid");
    if (!uid) badRequest("Administrator id is required.");
    sendJson(res, 200, await updateAdministratorRole(req, uid, await readJson(req)));
    return;
  }
  badRequest("PATCH is not supported for this admin resource.");
}

async function handlePost(req, res) {
  const body = await readJson(req);
  const action = cleanText(body.action, 80);
  if (!ACTIONS.has(action)) badRequest("Invalid admin API action.");

  if (action === "update_admin_profile") return updateAdminProfile(req, res);
  if (action === "promote_administrator") return sendJson(res, 200, await promoteAdministrator(req, body));
  if (action === "update_administrator") return sendJson(res, 200, await updateAdministratorRole(req, cleanText(body.uid, 240), body));
  if (action === "suspend_administrator") return sendJson(res, 200, await suspendAdministrator(req, cleanText(body.uid, 240), body));
  if (action === "reactivate_administrator") return sendJson(res, 200, await reactivateAdministrator(req, cleanText(body.uid, 240), body));
  if (action === "revoke_administrator") return sendJson(res, 200, await revokeAdministrator(req, cleanText(body.uid, 240), body));

  const admin = await requireAdmin(req);
  if (action === "update_user") return sendJson(res, 200, await updateUserProfile(admin, cleanText(body.uid, 240), body));
  if (action === "update_user_status") return sendJson(res, 200, await updateUserStatus(admin, cleanText(body.uid, 240), body));
  if (action === "grant_subscription") return sendJson(res, 200, await grantSubscription(admin, body));
  if (action === "extend_subscription") return sendJson(res, 200, await extendSubscription(admin, cleanText(body.subscriptionId, 240), body));
  if (action === "cancel_subscription") return sendJson(res, 200, await cancelSubscription(admin, cleanText(body.subscriptionId, 240), body));
  if (action === "revoke_subscription") return sendJson(res, 200, await revokeSubscription(admin, cleanText(body.subscriptionId, 240), body));
  if (action === "reactivate_subscription") return sendJson(res, 200, await reactivateSubscription(admin, cleanText(body.subscriptionId, 240), body));
  if (action === "reconcile_transaction") return sendJson(res, 200, await reconcileTransaction(admin, cleanText(body.transactionId, 240)));
  if (action === "add_note") return sendJson(res, 200, await addAdminNote(admin, cleanText(body.entityType, 80), cleanText(body.entityId, 240), body));
  if (action === "create_plan") return sendJson(res, 200, await createPlan(admin, body));
  if (action === "update_plan") return sendJson(res, 200, await updatePlan(admin, cleanText(body.planId, 160), body));
  if (action === "duplicate_plan") return sendJson(res, 200, await duplicatePlan(admin, cleanText(body.planId, 160)));
  if (["publish_plan", "unpublish_plan", "archive_plan", "restore_plan"].includes(action)) {
    const nextStatus = action === "publish_plan" ? "active" : action === "unpublish_plan" ? "unpublished" : action === "archive_plan" ? "archived" : "draft";
    return sendJson(res, 200, await setPlanStatus(admin, cleanText(body.planId, 160), nextStatus));
  }
  if (action === "trash_plan") return sendJson(res, 200, await trashPlan(admin, cleanText(body.planId, 160)));
  if (action === "delete_unused_plan") return sendJson(res, 200, await deleteUnusedPlan(admin, cleanText(body.planId, 160), body));
  if (action === "create_plan_variant" || action === "update_plan_variant") return sendJson(res, 200, await updatePlanVariant(admin, body));
  if (["enable_plan_variant", "disable_plan_variant", "archive_plan_variant"].includes(action)) {
    const nextStatus = action === "enable_plan_variant" ? "active" : action === "disable_plan_variant" ? "disabled" : "archived";
    return sendJson(res, 200, await setPlanVariantStatus(admin, cleanText(body.variantId, 160), nextStatus));
  }
  if (action === "delete_unused_plan_variant") return sendJson(res, 200, await deleteUnusedPlanVariant(admin, cleanText(body.variantId, 160), body));
  if (action === "save_resource") return sendJson(res, 200, await saveAdminResource(admin, body));
  if (action === "duplicate_resource") return sendJson(res, 200, await duplicateAdminResource(admin, cleanText(body.resourceId, 240)));
  if (["publish_resource", "schedule_resource", "unpublish_resource", "archive_resource"].includes(action)) {
    const nextStatus = action === "publish_resource" ? "published" : action === "schedule_resource" ? "scheduled" : action === "unpublish_resource" ? "unpublished" : "archived";
    return sendJson(res, 200, await setAdminResourceStatus(admin, cleanText(body.resourceId, 240), nextStatus, body));
  }
  if (action === "restore_resource") return sendJson(res, 200, await setAdminResourceStatus(admin, cleanText(body.resourceId, 240), "draft", body));
  if (action === "delete_resource") return sendJson(res, 200, await deleteAdminResource(admin, cleanText(body.resourceId, 240), body));
  if (action === "create_upload_session") return sendJson(res, 200, await createUploadSession(admin, body));
  if (action === "save_target") return sendJson(res, 200, await saveAdminTarget(admin, body));
  if (["publish_target", "unpublish_target", "archive_target", "restore_target", "complete_target"].includes(action)) {
    const nextStatus = action === "publish_target" ? "published" : action === "unpublish_target" ? "unpublished" : action === "archive_target" ? "archived" : action === "restore_target" ? "draft" : "completed";
    return sendJson(res, 200, await setAdminTargetStatus(admin, cleanText(body.targetId, 240), nextStatus, body));
  }
  if (action === "delete_target") return sendJson(res, 200, await deleteAdminTarget(admin, cleanText(body.targetId, 240), body));
  if (action === "save_class") return sendJson(res, 200, await saveAdminClass(admin, body));
  if (["publish_class", "unpublish_class", "cancel_class", "record_class", "archive_class", "restore_class"].includes(action)) {
    const nextStatus = action === "publish_class" ? "published" : action === "unpublish_class" ? "unpublished" : action === "cancel_class" ? "cancelled" : action === "record_class" ? "recorded" : action === "restore_class" ? "draft" : "archived";
    return sendJson(res, 200, await setAdminClassStatus(admin, cleanText(body.classId, 240), nextStatus, body));
  }
  if (action === "delete_class") return sendJson(res, 200, await deleteAdminClass(admin, cleanText(body.classId, 240), body));
  badRequest("Invalid admin API action.");
}

export default async function handler(req, res) {
  try {
    const resource = queryResource(req);
    if (req.method === "GET") return await handleGet(req, res, resource);
    if (req.method === "PATCH") return await handlePatch(req, res, resource);
    if (req.method === "POST") return await handlePost(req, res);
    if (!method(req, res, ["GET", "PATCH", "POST"])) return;
  } catch (error) {
    handleError(res, error);
  }
}











