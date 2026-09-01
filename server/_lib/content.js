import { getStorage } from "firebase-admin/storage";
import { getDb, requireUser, serverTimestamp } from "./firebaseAdmin.js";
import { hasPermission, writeAdminActivityLog } from "./adminAuth.js";
import { getVariant, plans } from "./plans.js";

const RESOURCE_TYPES = new Set(["pdf", "image", "external_link", "video"]);
const RESOURCE_STATUS = new Set(["draft", "scheduled", "published", "unpublished", "archived", "deleted"]);
const CLASS_STATUS = new Set(["draft", "published", "upcoming", "live", "recorded", "unpublished", "cancelled", "archived", "deleted"]);
const TARGET_STATUS = new Set(["draft", "scheduled", "published", "unpublished", "completed", "archived", "deleted"]);
const PRIVATE_PREFIX = "protected-resources";

function fail(statusCode, message, code = "CONTENT_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

function cleanText(value, max = 400) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanId(value, label = "ID") {
  const id = cleanText(value, 240);
  if (!id) fail(400, `${label} is required.`, "INVALID_ID");
  if (/%(?![0-9A-Fa-f]{2})/.test(id)) fail(400, `${label} is malformed.`, "MALFORMED_ID");
  return id;
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(value) {
  return toDate(value)?.toISOString() || null;
}

function listValue(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 120)).filter(Boolean))];
}

function safeHttpsUrl(value) {
  const text = String(value || "").trim().slice(0, 1200);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function planAssignments(body = {}) {
  const planIds = listValue(body.planIds).filter((id) => plans.some((plan) => plan.planId === id));
  const variantIds = listValue(body.variantIds).filter((id) => getVariant(id));
  return { planIds, variantIds };
}

function planLabels(planIds = [], variantIds = []) {
  const labels = new Set();
  planIds.forEach((planId) => {
    const plan = plans.find((item) => item.planId === planId);
    if (plan) labels.add(plan.name === "PICK UP" ? "PICK UP DAILY TARGETS" : plan.name);
  });
  variantIds.forEach((variantId) => {
    const match = getVariant(variantId);
    if (match) labels.add(`${match.plan.name === "PICK UP" ? "PICK UP DAILY TARGETS" : match.plan.name} ${match.variant.durationLabel}`);
  });
  return [...labels];
}

function isNowPublished(data = {}) {
  if (data.status !== "published") return false;
  const publishAt = toDate(data.publishAt);
  return !publishAt || publishAt.getTime() <= Date.now();
}

function isStudentVisible(collection, data = {}) {
  if (collection === "classes") return ["published", "upcoming", "live", "recorded"].includes(data.status || "draft");
  return isNowPublished(data);
}

function assertAnyPermission(admin, permissions) {
  if (permissions.some((permission) => hasPermission(admin, permission)) || admin.role === "super_admin") return;
  fail(403, "This administrator role cannot manage learning content.", "PERMISSION_DENIED");
}

function assertView(admin, permission = "resources.view") {
  assertAnyPermission(admin, [permission, permission.replace(".view", ".manage")]);
}

function assertManage(admin, permission = "resources.manage") {
  assertAnyPermission(admin, [permission]);
}

function assertSuperAdmin(admin) {
  if (admin?.role !== "super_admin") fail(403, "Only a super administrator can permanently delete content.", "SUPER_ADMIN_REQUIRED");
}

function sanitizeResource(id, data = {}, { includePrivate = true, entitlement = null } = {}) {
  const assignments = { planIds: listValue(data.planIds), variantIds: listValue(data.variantIds) };
  const type = RESOURCE_TYPES.has(data.type) ? data.type : "external_link";
  const status = RESOURCE_STATUS.has(data.status) ? data.status : "draft";
  const base = {
    id,
    resourceId: id,
    title: cleanText(data.title || "Untitled resource", 180),
    description: cleanText(data.description, 900),
    type,
    status,
    accessScope: data.accessScope === "public" ? "public" : data.accessScope === "all_plans" ? "all_plans" : "plan",
    planIds: assignments.planIds,
    variantIds: assignments.variantIds,
    planLabels: planLabels(assignments.planIds, assignments.variantIds),
    tags: listValue(data.tags),
    targetExams: listValue(data.targetExams),
    publishAt: iso(data.publishAt),
    publishedAt: iso(data.publishedAt),
    expiresAt: iso(data.expiresAt),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    deletedAt: iso(data.deletedAt),
    createdBy: data.createdBy || "",
    updatedBy: data.updatedBy || "",
    fileName: cleanText(data.fileName, 240),
    mimeType: cleanText(data.mimeType, 120),
    fileSize: Number(data.fileSize || 0) || 0,
    externalUrl: type === "external_link" || type === "video" ? safeHttpsUrl(data.externalUrl || data.videoUrl) : "",
    analytics: {
      views: Number(data.analytics?.views || 0) || 0,
      downloads: Number(data.analytics?.downloads || 0) || 0,
      lastViewedAt: iso(data.analytics?.lastViewedAt)
    },
    entitlement: entitlement || { allowed: false, reason: "not_checked" }
  };
  if (includePrivate) return { ...base, storagePath: cleanText(data.storagePath, 700), uploadState: data.uploadState || "none", reviewNotes: cleanText(data.reviewNotes, 700) };
  return base;
}

function sanitizeTarget(id, data = {}, { includePrivate = true } = {}) {
  const assignments = planAssignments(data);
  return {
    id,
    targetId: id,
    title: cleanText(data.title || "Untitled target", 180),
    description: cleanText(data.description, 1200),
    cadence: data.cadence === "weekly" ? "weekly" : "daily",
    status: TARGET_STATUS.has(data.status) ? data.status : "draft",
    targetDate: iso(data.targetDate),
    weekStart: iso(data.weekStart),
    tasks: Array.isArray(data.tasks) ? data.tasks.map((task, index) => ({ id: cleanText(task.id || `task-${index + 1}`, 80), title: cleanText(task.title || task, 220), subject: cleanText(task.subject, 120), estimatedMinutes: Number(task.estimatedMinutes || 0) || 0 })).filter((task) => task.title) : [],
    planIds: assignments.planIds,
    variantIds: assignments.variantIds,
    planLabels: planLabels(assignments.planIds, assignments.variantIds),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    deletedAt: iso(data.deletedAt),
    createdBy: includePrivate ? data.createdBy || "" : undefined,
    updatedBy: includePrivate ? data.updatedBy || "" : undefined
  };
}

function sanitizeClass(id, data = {}, { includePrivate = true } = {}) {
  const assignments = planAssignments(data);
  const status = CLASS_STATUS.has(data.status) ? data.status : "draft";
  const start = toDate(data.startAt);
  const end = toDate(data.endAt);
  const now = Date.now();
  const canJoin = includePrivate && (status === "live" || status === "published" || (status === "upcoming" && start && Math.abs(now - start.getTime()) <= 30 * 60 * 1000));
  return {
    id,
    classId: id,
    title: cleanText(data.title || "Untitled class", 180),
    description: cleanText(data.description, 900),
    status,
    mode: data.mode === "recorded" ? "recorded" : "live",
    startAt: iso(start),
    endAt: iso(end),
    host: cleanText(data.host || "Imran Sir", 120),
    meetingUrl: includePrivate && canJoin ? safeHttpsUrl(data.meetingUrl) : "",
    recordedVideoUrl: includePrivate && ["recorded", "published", "live"].includes(status) ? safeHttpsUrl(data.recordedVideoUrl) : "",
    planIds: assignments.planIds,
    variantIds: assignments.variantIds,
    planLabels: planLabels(assignments.planIds, assignments.variantIds),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    deletedAt: iso(data.deletedAt),
    canJoin: Boolean(canJoin),
    createdBy: includePrivate ? data.createdBy || "" : undefined,
    updatedBy: includePrivate ? data.updatedBy || "" : undefined
  };
}


function hasPlanAssignment(data = {}) {
  return listValue(data.planIds).length > 0 || listValue(data.variantIds).length > 0 || data.accessScope === "all_plans";
}

function validateResourceForPublish(data = {}) {
  if (!cleanText(data.title)) fail(400, "Resource title is required before publishing.", "INVALID_RESOURCE");
  if (!cleanText(data.description)) fail(400, "Add a description or summary before publishing.", "INVALID_RESOURCE_DESCRIPTION");
  if (!RESOURCE_TYPES.has(data.type)) fail(400, "Select a valid resource type.", "INVALID_RESOURCE_TYPE");
  if (data.accessScope !== "public" && !hasPlanAssignment(data)) fail(400, "Assign at least one plan.", "MISSING_PLAN_ASSIGNMENT");
  if (["pdf", "image"].includes(data.type) && !cleanText(data.storagePath)) fail(400, `Upload a ${data.type === "pdf" ? "PDF" : "image"} file before publishing.`, "MISSING_RESOURCE_FILE");
  if (["external_link", "video"].includes(data.type) && !safeHttpsUrl(data.externalUrl || data.videoUrl)) fail(400, "Add a valid HTTPS content URL before publishing.", "INVALID_RESOURCE_URL");
}

function validateTargetForPublish(data = {}) {
  if (!cleanText(data.title)) fail(400, "Target title is required before publishing.", "INVALID_TARGET");
  if (!["daily", "weekly"].includes(data.cadence)) fail(400, "Select daily or weekly cadence.", "INVALID_TARGET_CADENCE");
  if (!hasPlanAssignment(data)) fail(400, "Assign at least one plan.", "MISSING_PLAN_ASSIGNMENT");
  if (!Array.isArray(data.tasks) || data.tasks.filter((task) => cleanText(task.title || task)).length < 1) fail(400, "Add at least one task.", "MISSING_TARGET_TASKS");
  const start = toDate(data.startAt || data.weekStart || data.targetDate);
  const due = toDate(data.dueAt || data.endAt || data.targetDate);
  if (!start) fail(400, "Select a valid start date.", "INVALID_TARGET_START");
  if (!due) fail(400, "Select a valid due date.", "INVALID_TARGET_DUE");
  if (due.getTime() < start.getTime()) fail(400, "The due date cannot be before the start date.", "INVALID_TARGET_DATE_RANGE");
}

function validateClassForPublish(data = {}) {
  if (!cleanText(data.title)) fail(400, "Class title is required before publishing.", "INVALID_CLASS");
  if (!hasPlanAssignment(data)) fail(400, "Assign at least one plan.", "MISSING_PLAN_ASSIGNMENT");
  if (data.mode === "recorded") {
    if (!cleanText(data.description)) fail(400, "Add a class summary before publishing.", "INVALID_CLASS_DESCRIPTION");
    if (!safeHttpsUrl(data.recordedVideoUrl)) fail(400, "Add a valid HTTPS recorded video URL before publishing.", "INVALID_CLASS_VIDEO");
    return;
  }
  if (!toDate(data.startAt)) fail(400, "Select a valid class start date and time.", "INVALID_CLASS_START");
  if (!cleanText(data.timezone || "Asia/Kolkata")) fail(400, "Select a valid timezone.", "INVALID_CLASS_TIMEZONE");
  if (!safeHttpsUrl(data.meetingUrl)) fail(400, "Add a secure meeting URL before publishing.", "INVALID_CLASS_MEETING_URL");
}
async function collectActiveEntitlements(uid) {
  const db = getDb();
  const snap = await db.collection("subscriptions").where("userId", "==", uid).where("status", "==", "active").limit(100).get();
  const planIds = new Set();
  const variantIds = new Set();
  const now = Date.now();
  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const end = toDate(data.accessEndAt || data.accessEnd || data.endDate || data.end_date);
    if (end && end.getTime() <= now) return;
    if (data.planId || data.plan_id) planIds.add(data.planId || data.plan_id);
    if (data.variantId || data.variant_id || data.durationId) variantIds.add(data.variantId || data.variant_id || data.durationId);
  });
  return { uid, planIds, variantIds, hasActiveAccess: planIds.size > 0 || variantIds.size > 0 };
}

function hasEntitlement(item, entitlements) {
  if (item.accessScope === "public") return { allowed: true, reason: "public" };
  if (item.accessScope === "all_plans" && entitlements.hasActiveAccess) return { allowed: true, reason: "all_plans" };
  const planIds = listValue(item.planIds);
  const variantIds = listValue(item.variantIds);
  if (!planIds.length && !variantIds.length) return { allowed: false, reason: "unassigned" };
  if (planIds.some((id) => entitlements.planIds.has(id))) return { allowed: true, reason: "plan" };
  if (variantIds.some((id) => entitlements.variantIds.has(id))) return { allowed: true, reason: "variant" };
  return { allowed: false, reason: "subscription_required" };
}

async function getDocOr404(collection, id, label) {
  const doc = await getDb().collection(collection).doc(cleanId(id, `${label} ID`)).get();
  if (!doc.exists) fail(404, `${label} was not found.`, `${label.toUpperCase()}_NOT_FOUND`);
  return doc;
}

function applyQuery(list, query = {}) {
  const status = cleanText(query.status, 80);
  const type = cleanText(query.type, 80);
  const planId = cleanText(query.planId || query.plan, 80);
  const search = cleanText(query.search || query.q, 160).toLowerCase();
  return list.filter((item) => {
    if (!status && ["archived", "deleted"].includes(item.status)) return false;
    if (status && item.status !== status) return false;
    if (type && item.type !== type && item.cadence !== type && item.mode !== type) return false;
    if (planId && !(item.planIds || []).includes(planId) && !(item.variantIds || []).some((variantId) => getVariant(variantId)?.plan.planId === planId)) return false;
    if (search && !`${item.title} ${item.description}`.toLowerCase().includes(search)) return false;
    return true;
  });
}

async function listCollection(collection, sanitizer, query = {}, options = {}) {
  const snap = await getDb().collection(collection).orderBy("updatedAt", "desc").limit(200).get();
  const items = applyQuery(snap.docs.map((doc) => sanitizer(doc.id, doc.data(), options)), query);
  return { items, total: items.length, page: 1, pageSize: items.length, hasMore: false };
}


async function logContentAction(admin, action, entityType, entityId, data, previousStatus, newStatus, reason = "") {
  await writeAdminActivityLog({ admin, action, entityType, entityId, safeMetadata: { title: cleanText(data?.title, 180), previousStatus: previousStatus || "", newStatus: newStatus || "", reason: cleanText(reason, 400) } });
}

async function setStatus({ admin, collection, id, label, permission, statuses, sanitizer, status, validatePublish, reason = "" }) {
  assertManage(admin, permission);
  if (!statuses.has(status)) fail(400, `Unsupported ${label} status.`, "INVALID_STATUS");
  const doc = await getDocOr404(collection, id, label);
  const data = doc.data();
  if (data.status === "deleted" && status !== "draft") fail(409, `Restore this ${label} before changing its status.`, "DELETED_CONTENT");
  if (status === "published") validatePublish({ ...data, status });
  const previousStatus = data.status || "draft";
  const payload = { status, previousStatus, updatedAt: serverTimestamp(), updatedBy: admin.uid };
  if (status === "published" && !data.publishedAt) payload.publishedAt = serverTimestamp();
  if (status === "draft") payload.restoredAt = serverTimestamp();
  await doc.ref.set(payload, { merge: true });
  await logContentAction(admin, `${label}.${status === "draft" ? "restore" : status}`, label, doc.id, data, previousStatus, status, reason);
  const saved = await doc.ref.get();
  return { [label === "class" ? "classSession" : label]: sanitizer(saved.id, saved.data(), { includePrivate: true }) };
}

async function softDelete({ admin, collection, id, label, permission, sanitizer, reason = "" }) {
  assertManage(admin, permission);
  const doc = await getDocOr404(collection, id, label);
  const data = doc.data();
  const previousStatus = data.status || "draft";
  const payload = { status: "deleted", previousStatus, deletedAt: serverTimestamp(), deletedBy: admin.uid, updatedAt: serverTimestamp(), updatedBy: admin.uid };
  if (label === "target") {
    const progress = await getDb().collection("targetProgress").where("targetId", "==", doc.id).limit(1).get().catch(() => ({ empty: true }));
    payload.progressExists = !progress.empty;
  }
  await doc.ref.set(payload, { merge: true });
  await logContentAction(admin, `${label}.delete`, label, doc.id, data, previousStatus, "deleted", reason);
  const saved = await doc.ref.get();
  return { [label === "class" ? "classSession" : label]: sanitizer(saved.id, saved.data(), { includePrivate: true }), deleted: true, softDeleted: true, progressExists: payload.progressExists || false };
}

export async function listAdminResources(admin, query = {}) {
  assertView(admin);
  return { resources: await listCollection("resources", sanitizeResource, query, { includePrivate: true }) };
}

export async function getAdminResource(admin, id) {
  assertView(admin);
  const doc = await getDocOr404("resources", id, "resource");
  const events = await getDb().collection("contentEvents").where("resourceId", "==", doc.id).orderBy("createdAt", "desc").limit(50).get().catch(() => ({ docs: [] }));
  return { resource: sanitizeResource(doc.id, doc.data(), { includePrivate: true }), events: events.docs.map((item) => ({ id: item.id, ...item.data(), createdAt: iso(item.data().createdAt) })) };
}

export async function saveAdminResource(admin, body = {}) {
  assertManage(admin, "resources.manage");
  const db = getDb();
  const id = cleanText(body.resourceId || body.id, 240);
  const existing = id ? await db.collection("resources").doc(id).get() : null;
  const existingData = existing?.exists ? existing.data() : {};
  const type = RESOURCE_TYPES.has(body.type) ? body.type : existingData.type || "external_link";
  const status = RESOURCE_STATUS.has(body.status) ? body.status : existingData.status || "draft";
  const assignments = planAssignments(body);
  const payload = {
    title: cleanText(body.title, 180),
    description: cleanText(body.description, 900),
    type,
    status,
    accessScope: body.accessScope === "public" ? "public" : body.accessScope === "all_plans" ? "all_plans" : "plan",
    ...assignments,
    tags: listValue(body.tags),
    targetExams: listValue(body.targetExams),
    publishAt: body.publishAt ? new Date(body.publishAt) : existingData.publishAt || null,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : existingData.expiresAt || null,
    externalUrl: ["external_link", "video"].includes(type) ? safeHttpsUrl(body.externalUrl || body.videoUrl) : "",
    fileName: cleanText(body.fileName || existingData.fileName, 240),
    mimeType: cleanText(body.mimeType || existingData.mimeType, 120),
    fileSize: Number(body.fileSize || existingData.fileSize || 0) || 0,
    storagePath: cleanText(body.storagePath || existingData.storagePath, 700),
    uploadState: body.storagePath || existingData.storagePath ? "uploaded" : "none",
    reviewNotes: cleanText(body.reviewNotes, 700),
    updatedAt: serverTimestamp(),
    updatedBy: admin.uid
  };
  if (!payload.title) fail(400, "Resource title is required.", "INVALID_RESOURCE");
  if (status === "published") validateResourceForPublish(payload);
  const ref = existing?.exists ? existing.ref : db.collection("resources").doc();
  await ref.set({ ...payload, ...(existing?.exists ? {} : { createdAt: serverTimestamp(), createdBy: admin.uid, analytics: { views: 0, downloads: 0 } }), ...(status === "published" && !existingData.publishedAt ? { publishedAt: serverTimestamp() } : {}) }, { merge: true });
  const saved = await ref.get();
  await logContentAction(admin, existing?.exists ? "resource.update" : "resource.create", "resource", ref.id, payload, existingData.status, status, cleanText(body.reason));
  return { resource: sanitizeResource(saved.id, saved.data(), { includePrivate: true }) };
}
export async function duplicateAdminResource(admin, id) {
  assertManage(admin, "resources.manage");
  const source = await getDocOr404("resources", id, "resource");
  const data = source.data();
  const ref = getDb().collection("resources").doc();
  await ref.set({ ...data, title: `${cleanText(data.title, 150)} Copy`, status: "draft", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: admin.uid, updatedBy: admin.uid, analytics: { views: 0, downloads: 0 } });
  await writeAdminActivityLog({ admin, action: "resource.duplicate", entityType: "resource", entityId: ref.id, safeMetadata: { sourceId: source.id } });
  const saved = await ref.get();
  return { resource: sanitizeResource(saved.id, saved.data(), { includePrivate: true }) };
}

export function setAdminResourceStatus(admin, id, status, body = {}) {
  return setStatus({ admin, collection: "resources", id, label: "resource", permission: "resources.manage", statuses: RESOURCE_STATUS, sanitizer: sanitizeResource, status, validatePublish: validateResourceForPublish, reason: body.reason });
}

export function deleteAdminResource(admin, id, body = {}) {
  return softDelete({ admin, collection: "resources", id, label: "resource", permission: "resources.manage", sanitizer: sanitizeResource, reason: body.reason });
}

export async function createUploadSession(admin, body = {}) {
  assertManage(admin);
  const filename = cleanText(body.filename, 180).replace(/[\\/:*?"<>|]/g, "-");
  const mimeType = cleanText(body.mimeType, 120);
  const size = Number(body.size || 0) || 0;
  const kind = cleanText(body.kind || "resource", 60);
  if (!filename) fail(400, "Filename is required.", "INVALID_UPLOAD");
  if (size > 25 * 1024 * 1024) fail(400, "Files must be 25 MB or smaller.", "UPLOAD_TOO_LARGE");
  if (!/^application\/pdf$|^image\//.test(mimeType)) fail(400, "Only PDF and image uploads are supported in this phase.", "UNSUPPORTED_UPLOAD_TYPE");
  const storagePath = `${PRIVATE_PREFIX}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;
  return { upload: { storagePath, bucket: getStorage().bucket().name, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), maxBytes: 25 * 1024 * 1024, contentType: mimeType } };
}

export async function listAdminTargets(admin, query = {}) {
  assertView(admin);
  return { targets: await listCollection("targets", sanitizeTarget, query, { includePrivate: true }) };
}

export async function getAdminTarget(admin, id) {
  assertView(admin);
  const doc = await getDocOr404("targets", id, "target");
  return { target: sanitizeTarget(doc.id, doc.data(), { includePrivate: true }) };
}

export async function saveAdminTarget(admin, body = {}) {
  assertManage(admin, "targets.manage");
  const db = getDb();
  const id = cleanText(body.targetId || body.id, 240);
  const ref = id ? db.collection("targets").doc(id) : db.collection("targets").doc();
  const existing = id ? await ref.get() : null;
  const existingData = existing?.exists ? existing.data() : {};
  const status = TARGET_STATUS.has(body.status) ? body.status : existingData.status || "draft";
  const payload = {
    title: cleanText(body.title, 180),
    description: cleanText(body.description, 1200),
    cadence: body.cadence === "weekly" ? "weekly" : "daily",
    status,
    ...planAssignments(body),
    targetDate: body.targetDate ? new Date(body.targetDate) : existingData.targetDate || null,
    startAt: body.startAt ? new Date(body.startAt) : body.targetDate ? new Date(body.targetDate) : existingData.startAt || existingData.targetDate || null,
    dueAt: body.dueAt ? new Date(body.dueAt) : body.targetDate ? new Date(body.targetDate) : existingData.dueAt || existingData.targetDate || null,
    weekStart: body.weekStart ? new Date(body.weekStart) : existingData.weekStart || null,
    tasks: Array.isArray(body.tasks) ? body.tasks.map((task, index) => ({ id: cleanText(task.id || `task-${index + 1}`, 80), title: cleanText(task.title || task, 220), subject: cleanText(task.subject, 120), estimatedMinutes: Number(task.estimatedMinutes || 0) || 0 })).filter((task) => task.title) : existingData.tasks || [],
    updatedAt: serverTimestamp(),
    updatedBy: admin.uid
  };
  if (!payload.title) fail(400, "Target title is required.", "INVALID_TARGET");
  if (status === "published") validateTargetForPublish(payload);
  await ref.set({ ...payload, ...(existing?.exists ? {} : { createdAt: serverTimestamp(), createdBy: admin.uid }) }, { merge: true });
  const saved = await ref.get();
  await logContentAction(admin, existing?.exists ? "target.update" : "target.create", "target", ref.id, payload, existingData.status, status, cleanText(body.reason));
  return { target: sanitizeTarget(saved.id, saved.data(), { includePrivate: true }) };
}

export function setAdminTargetStatus(admin, id, status, body = {}) {
  return setStatus({ admin, collection: "targets", id, label: "target", permission: "targets.manage", statuses: TARGET_STATUS, sanitizer: sanitizeTarget, status, validatePublish: validateTargetForPublish, reason: body.reason });
}

export function deleteAdminTarget(admin, id, body = {}) {
  return softDelete({ admin, collection: "targets", id, label: "target", permission: "targets.manage", sanitizer: sanitizeTarget, reason: body.reason });
}
export async function listAdminClasses(admin, query = {}) {
  assertView(admin);
  return { classes: await listCollection("classes", sanitizeClass, query, { includePrivate: true }) };
}

export async function getAdminClass(admin, id) {
  assertView(admin);
  const doc = await getDocOr404("classes", id, "class");
  return { classSession: sanitizeClass(doc.id, doc.data(), { includePrivate: true }) };
}

export async function saveAdminClass(admin, body = {}) {
  assertManage(admin, "classes.manage");
  const db = getDb();
  const id = cleanText(body.classId || body.id, 240);
  const ref = id ? db.collection("classes").doc(id) : db.collection("classes").doc();
  const existing = id ? await ref.get() : null;
  const existingData = existing?.exists ? existing.data() : {};
  const status = CLASS_STATUS.has(body.status) ? body.status : existingData.status || "draft";
  const mode = body.mode === "recorded" ? "recorded" : "live";
  const payload = {
    title: cleanText(body.title, 180),
    description: cleanText(body.description, 900),
    status,
    mode,
    ...planAssignments(body),
    startAt: body.startAt ? new Date(body.startAt) : existingData.startAt || null,
    endAt: body.endAt ? new Date(body.endAt) : existingData.endAt || null,
    timezone: cleanText(body.timezone || existingData.timezone || "Asia/Kolkata", 80),
    host: cleanText(body.host || existingData.host || "Imran Sir", 120),
    meetingUrl: safeHttpsUrl(body.meetingUrl || existingData.meetingUrl),
    recordedVideoUrl: safeHttpsUrl(body.recordedVideoUrl || existingData.recordedVideoUrl),
    updatedAt: serverTimestamp(),
    updatedBy: admin.uid
  };
  if (!payload.title) fail(400, "Class title is required.", "INVALID_CLASS");
  if (["published", "upcoming", "live", "recorded"].includes(status)) validateClassForPublish(payload);
  await ref.set({ ...payload, ...(existing?.exists ? {} : { createdAt: serverTimestamp(), createdBy: admin.uid }) }, { merge: true });
  const saved = await ref.get();
  await logContentAction(admin, existing?.exists ? "class.update" : "class.create", "class", ref.id, payload, existingData.status, status, cleanText(body.reason));
  return { classSession: sanitizeClass(saved.id, saved.data(), { includePrivate: true }) };
}

export function setAdminClassStatus(admin, id, status, body = {}) {
  return setStatus({ admin, collection: "classes", id, label: "class", permission: "classes.manage", statuses: CLASS_STATUS, sanitizer: sanitizeClass, status, validatePublish: validateClassForPublish, reason: body.reason });
}

export function deleteAdminClass(admin, id, body = {}) {
  return softDelete({ admin, collection: "classes", id, label: "class", permission: "classes.manage", sanitizer: sanitizeClass, reason: body.reason });
}
async function signedUrlFor(path, disposition = "inline") {
  if (!path || !path.startsWith(`${PRIVATE_PREFIX}/`)) fail(404, "Protected file is unavailable.", "FILE_NOT_FOUND");
  const [url] = await getStorage().bucket().file(path).getSignedUrl({ action: "read", expires: Date.now() + 5 * 60 * 1000, responseDisposition: disposition });
  return url;
}

async function requireStudentEntitlements(req) {
  const user = await requireUser(req);
  return { user, entitlements: await collectActiveEntitlements(user.uid) };
}

export async function getStudentContentDashboard(req) {
  const { user, entitlements } = await requireStudentEntitlements(req);
  const [resources, targets, classes] = await Promise.all([listStudentResources(req, { limit: 6 }), listStudentTargets(req, { limit: 4 }), listStudentClasses(req, { limit: 4 })]);
  return { user: { uid: user.uid, email: user.email || "", displayName: user.name || user.email || "Student" }, access: { planIds: [...entitlements.planIds], variantIds: [...entitlements.variantIds], active: entitlements.hasActiveAccess }, resources: resources.resources.items, targets: targets.targets.items, classes: classes.classes.items };
}

async function listEntitled(collection, sanitizer, req, query = {}) {
  const { entitlements } = await requireStudentEntitlements(req);
  const snap = await getDb().collection(collection).orderBy("updatedAt", "desc").limit(200).get();
  const items = snap.docs.map((doc) => {
    const data = doc.data();
    const entitlement = hasEntitlement(data, entitlements);
    return { data, item: sanitizer(doc.id, data, { includePrivate: false, entitlement }) };
  }).filter(({ data, item }) => isStudentVisible(collection, data) && item.entitlement.allowed).map(({ item }) => item);
  return { items: applyQuery(items, query), total: items.length, page: 1, pageSize: items.length };
}

export async function listStudentResources(req, query = {}) {
  return { resources: await listEntitled("resources", sanitizeResource, req, query) };
}

export async function getStudentResource(req, id) {
  const { entitlements } = await requireStudentEntitlements(req);
  const doc = await getDocOr404("resources", id, "resource");
  const data = doc.data();
  const entitlement = hasEntitlement(data, entitlements);
  if (!isNowPublished(data) || !entitlement.allowed) fail(403, "Your current plan does not include this resource.", "CONTENT_ACCESS_DENIED");
  return { resource: sanitizeResource(doc.id, data, { includePrivate: false, entitlement }) };
}

export async function requestFileAccess(req, body = {}) {
  const resourceId = cleanId(body.resourceId, "Resource ID");
  const { entitlements, user } = await requireStudentEntitlements(req);
  const doc = await getDocOr404("resources", resourceId, "resource");
  const data = doc.data();
  const entitlement = hasEntitlement(data, entitlements);
  if (!isNowPublished(data) || !entitlement.allowed) fail(403, "Your current plan does not include this file.", "CONTENT_ACCESS_DENIED");
  if (!["pdf", "image"].includes(data.type)) fail(400, "This resource does not have a protected file.", "INVALID_RESOURCE_TYPE");
  const download = Boolean(body.download);
  const url = await signedUrlFor(data.storagePath, download ? "attachment" : "inline");
  await getDb().collection("contentEvents").add({ uid: user.uid, resourceId, action: download ? "download" : "file_access", createdAt: serverTimestamp() });
  await doc.ref.set({ analytics: { views: Number(data.analytics?.views || 0) + 1, downloads: Number(data.analytics?.downloads || 0) + (download ? 1 : 0), lastViewedAt: serverTimestamp() } }, { merge: true });
  return { file: { url, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), download } };
}

export async function recordResourceView(req, body = {}) {
  const resourceId = cleanId(body.resourceId, "Resource ID");
  const user = await requireUser(req);
  await getDb().collection("contentEvents").add({ uid: user.uid, resourceId, action: "view", createdAt: serverTimestamp() });
  return { ok: true };
}

export async function listStudentTargets(req, query = {}) {
  return { targets: await listEntitled("targets", sanitizeTarget, req, query) };
}

export async function getStudentTarget(req, id) {
  const { entitlements, user } = await requireStudentEntitlements(req);
  const doc = await getDocOr404("targets", id, "target");
  const data = doc.data();
  const entitlement = hasEntitlement(data, entitlements);
  if (!isNowPublished(data) || !entitlement.allowed) fail(403, "Your current plan does not include this target.", "CONTENT_ACCESS_DENIED");
  const progressDoc = await getDb().collection("targetProgress").doc(`${user.uid}_${doc.id}`).get().catch(() => null);
  return { target: sanitizeTarget(doc.id, data, { includePrivate: false }), progress: progressDoc?.exists ? progressDoc.data() : { completedTaskIds: [], status: "not_started" } };
}

export async function updateTargetProgress(req, body = {}) {
  const targetId = cleanId(body.targetId, "Target ID");
  await getStudentTarget(req, targetId);
  const user = await requireUser(req);
  const completedTaskIds = listValue(body.completedTaskIds).slice(0, 100);
  const status = body.status === "completed" ? "completed" : completedTaskIds.length ? "in_progress" : "not_started";
  await getDb().collection("targetProgress").doc(`${user.uid}_${targetId}`).set({ uid: user.uid, targetId, completedTaskIds, status, updatedAt: serverTimestamp() }, { merge: true });
  return { progress: { uid: user.uid, targetId, completedTaskIds, status } };
}

export async function listStudentClasses(req, query = {}) {
  return { classes: await listEntitled("classes", sanitizeClass, req, query) };
}

export async function joinClass(req, body = {}) {
  const classId = cleanId(body.classId, "Class ID");
  const { entitlements, user } = await requireStudentEntitlements(req);
  const doc = await getDocOr404("classes", classId, "class");
  const data = doc.data();
  const entitlement = hasEntitlement(data, entitlements);
  if (!isStudentVisible("classes", data) || !entitlement.allowed) fail(403, "Your current plan does not include this class.", "CONTENT_ACCESS_DENIED");
  const safe = sanitizeClass(doc.id, data, { includePrivate: true });
  if (!safe.meetingUrl && !safe.recordedVideoUrl) fail(403, "This class is not open for joining yet.", "CLASS_NOT_OPEN");
  await getDb().collection("classAttendance").doc(`${user.uid}_${classId}`).set({ uid: user.uid, classId, joinedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  return { classSession: safe, joinUrl: safe.meetingUrl || safe.recordedVideoUrl };
}











