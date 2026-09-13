import crypto from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getDb, serverTimestamp } from "./firebaseAdmin.js";
import { hasPermission, writeAdminActivityLog } from "./adminAuth.js";
import { createNotification } from "./notifications.js";

const CATEGORIES = new Set(["plan_enquiry", "payment_help", "subscription_help", "resource_access", "targets", "classes", "refund_question", "technical_problem", "general_enquiry", "other"]);
const STATUSES = new Set(["open", "pending", "in_progress", "resolved", "closed"]);
const attempts = new Map();

function fail(statusCode, message, code = "SUPPORT_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}
function text(value, max) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, max); }
function email(value) { return text(value, 254).toLowerCase(); }
function iso(value) { return value?.toDate ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value || null; }
function requestIp(req) { return text(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0], 80); }
function referenceId() { return "DB-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + crypto.randomBytes(3).toString("hex").toUpperCase(); }
function safe(item) {
  return { id: item.id, referenceId: item.referenceId, fullName: item.fullName, email: item.email, mobile: item.mobile || "", category: item.category, relatedPlan: item.relatedPlan || "", subject: item.subject, message: item.message, status: item.status, assignedTo: item.assignedTo || "", assignedToEmail: item.assignedToEmail || "", internalNotes: item.internalNotes || [], conversation: item.conversation || [], verifiedUserUid: item.verifiedUserUid || "", verifiedUserEmail: item.verifiedUserEmail || "", createdAt: iso(item.createdAt), updatedAt: iso(item.updatedAt), resolvedAt: iso(item.resolvedAt), closedAt: iso(item.closedAt) };
}
async function optionalUser(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!match) return null;
  try { return await getAuth(getAdminApp()).verifyIdToken(match[1]); } catch { return null; }
}
function rateLimit(req) {
  const key = requestIp(req);
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((stamp) => now - stamp < 10 * 60_000);
  if (recent.length >= 5) fail(429, "Too many enquiries. Please wait before trying again.", "RATE_LIMITED");
  recent.push(now);
  attempts.set(key, recent);
}

export async function submitContactEnquiry(req, body = {}) {
  if (text(body.website, 200)) fail(400, "Submission could not be accepted.", "SPAM_REJECTED");
  rateLimit(req);
  const fullName = text(body.fullName, 120);
  const submittedEmail = email(body.email);
  const mobile = text(body.mobile, 24);
  const category = text(body.category, 40);
  const relatedPlan = text(body.relatedPlan, 120);
  const subject = text(body.subject, 180);
  const message = text(body.message, 3000);
  if (fullName.length < 2) fail(400, "Enter your full name.", "INVALID_NAME");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail)) fail(400, "Enter a valid email address.", "INVALID_EMAIL");
  if (mobile && !/^[+0-9 ()-]{7,24}$/.test(mobile)) fail(400, "Enter a valid mobile number.", "INVALID_MOBILE");
  if (!CATEGORIES.has(category)) fail(400, "Choose a valid enquiry category.", "INVALID_CATEGORY");
  if (subject.length < 3) fail(400, "Enter a subject.", "INVALID_SUBJECT");
  if (message.length < 10) fail(400, "Enter at least 10 characters in your message.", "INVALID_MESSAGE");
  if (body.consent !== true) fail(400, "Consent is required.", "CONSENT_REQUIRED");

  const user = await optionalUser(req);
  const fingerprint = crypto.createHash("sha256").update([requestIp(req), submittedEmail, category, subject.toLowerCase(), message.toLowerCase()].join("|")).digest("hex");
  const db = getDb();
  const duplicate = await db.collection("contactEnquiries").where("fingerprint", "==", fingerprint).limit(1).get();
  const cutoff = Date.now() - 15 * 60_000;
  if (duplicate.docs.some((doc) => (doc.data().createdAt?.toMillis?.() || 0) >= cutoff)) fail(409, "This enquiry was already received recently.", "DUPLICATE_ENQUIRY");

  const ref = db.collection("contactEnquiries").doc();
  const reference = referenceId();
  await ref.set({ referenceId: reference, fullName, email: submittedEmail, mobile, category, relatedPlan, subject, message, consent: true, status: "open", fingerprint, verifiedUserUid: user?.uid || "", verifiedUserEmail: user?.email || "", source: "website_contact", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { success: true, referenceId: reference };
}

export async function listContactEnquiries(admin, query = {}) {
  if (!hasPermission(admin, "support.view")) fail(403, "Permission denied.", "PERMISSION_DENIED");
  const snap = await getDb().collection("contactEnquiries").orderBy("createdAt", "desc").limit(250).get();
  const q = text(query.q || query.search, 160).toLowerCase();
  const category = text(query.category, 40);
  const status = text(query.status, 40);
  const start = query.start ? new Date(query.start).getTime() : null;
  const end = query.end ? new Date(query.end + "T23:59:59.999Z").getTime() : null;
  const items = snap.docs.map((doc) => safe({ id: doc.id, ...doc.data() })).filter((item) => (!q || (item.fullName + " " + item.email + " " + item.referenceId + " " + item.subject).toLowerCase().includes(q)) && (!category || item.category === category) && (!status || item.status === status) && (!start || new Date(item.createdAt).getTime() >= start) && (!end || new Date(item.createdAt).getTime() <= end));
  return { enquiries: { items, total: items.length } };
}
export async function getContactEnquiry(admin, id) {
  if (!hasPermission(admin, "support.view")) fail(403, "Permission denied.", "PERMISSION_DENIED");
  const snap = await getDb().collection("contactEnquiries").doc(text(id, 240)).get();
  if (!snap.exists) fail(404, "Enquiry not found.", "ENQUIRY_NOT_FOUND");
  return { enquiry: safe({ id: snap.id, ...snap.data() }) };
}
export async function updateContactEnquiry(admin, id, body = {}) {
  if (!hasPermission(admin, "support.manage")) fail(403, "Permission denied.", "PERMISSION_DENIED");
  const ref = getDb().collection("contactEnquiries").doc(text(id, 240));
  const snap = await ref.get();
  if (!snap.exists) fail(404, "Enquiry not found.", "ENQUIRY_NOT_FOUND");
  const previous = safe({ id: snap.id, ...snap.data() });
  const action = text(body.action, 50);
  const payload = { updatedAt: serverTimestamp(), updatedBy: admin.uid };
  if (action === "assign") { payload.assignedTo = text(body.assignedTo || admin.uid, 240); payload.assignedToEmail = text(body.assignedToEmail || admin.email, 254); }
  else if (action === "add_note") {
    const note = text(body.note, 1000);
    if (note.length < 2) fail(400, "Enter an internal note.", "INVALID_NOTE");
    payload.internalNotes = [...(snap.data().internalNotes || []), { note, adminUid: admin.uid, adminEmail: admin.email, createdAt: new Date().toISOString() }].slice(-100);
  } else {
    const status = action === "reopen" ? "open" : text(body.status || action.replace("mark_", ""), 40);
    if (!STATUSES.has(status)) fail(400, "Invalid enquiry status.", "INVALID_STATUS");
    payload.status = status;
    if (status === "resolved") payload.resolvedAt = serverTimestamp();
    if (status === "closed") payload.closedAt = serverTimestamp();
  }
  await ref.set(payload, { merge: true });
  const saved = await ref.get();
  const next = safe({ id: saved.id, ...saved.data() });
  await writeAdminActivityLog({ admin, action: "support.enquiry." + action, entityType: "contactEnquiry", entityId: id, safeMetadata: { referenceId: previous.referenceId, previousState: previous, newState: next } });
  return { enquiry: next };
}

export async function sendContactEnquiryReply(admin, id, body = {}) {
  if (!hasPermission(admin, "support.manage")) fail(403, "Permission denied.", "PERMISSION_DENIED");
  const enquiryId = text(id, 240), replyId = text(body.replyId, 120), replyText = text(body.reply, 5000);
  if (!replyId) fail(400, "A reply id is required.", "INVALID_REPLY_ID");
  if (replyText.length < 2) fail(400, "Enter a reply.", "INVALID_REPLY");
  const ref = getDb().collection("contactEnquiries").doc(enquiryId), snap = await ref.get();
  if (!snap.exists) fail(404, "Enquiry not found.", "ENQUIRY_NOT_FOUND");
  const enquiry = safe({ id: snap.id, ...snap.data() }), recipient = email(enquiry.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) fail(400, "The stored enquiry email is invalid.", "INVALID_EMAIL");
  const existing = enquiry.conversation.find((reply) => reply.replyId === replyId);
  if (existing) return { enquiry, reply: existing };
  const notificationId = await createNotification({ eventType: "admin_support_reply", uid: enquiry.verifiedUserUid || "support-" + enquiryId, email: recipient, title: "Support reply " + enquiry.referenceId, message: "The Delight Banking support team replied to your enquiry.", destination: "/student-desk/notifications", idempotencyKey: "support-reply:" + enquiryId + ":" + replyId, related: { enquiryId, referenceId: enquiry.referenceId }, templateData: { studentName: enquiry.fullName, referenceId: enquiry.referenceId, replyText } });
  const deliveries = await getDb().collection("notificationDeliveries").where("notificationId", "==", notificationId).limit(20).get();
  const deliveryDoc = deliveries.docs.find((doc) => doc.data().channel === "email"), delivery = deliveryDoc?.data() || {};
  const reply = { replyId, direction: "outbound", message: replyText, adminUid: admin.uid, adminDisplayName: text(admin.displayName || admin.email, 120), createdAt: new Date().toISOString(), notificationId, deliveryId: deliveryDoc?.id || "", providerMessageId: text(delivery.providerMessageId, 240), deliveryStatus: text(delivery.status, 50) || "failed", safeFailureCode: text(delivery.safeFailureCode, 100), safeFailureMessage: text(delivery.safeFailureMessage, 500) };
  await getDb().runTransaction(async (tx) => { const current = await tx.get(ref), conversation = current.data()?.conversation || []; if (conversation.some((item) => item.replyId === replyId)) return; tx.set(ref, { conversation: [...conversation, reply].slice(-100), status: "pending", updatedAt: serverTimestamp(), updatedBy: admin.uid }, { merge: true }); });
  await writeAdminActivityLog({ admin, action: "support.enquiry.reply", entityType: "contactEnquiry", entityId: enquiryId, safeMetadata: { referenceId: enquiry.referenceId, notificationId, deliveryId: reply.deliveryId, status: reply.deliveryStatus } });
  const saved = await ref.get();
  return { enquiry: safe({ id: saved.id, ...saved.data() }), reply };
}