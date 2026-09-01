import crypto from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getDb, serverTimestamp } from "./firebaseAdmin.js";
import { hasPermission, writeAdminActivityLog } from "./adminAuth.js";
import { getVariant, planSnapshot, plans } from "./plans.js";
import { normalizeOrder as normalizeAdminOrder, normalizeSubscription as normalizeAdminSubscription, normalizeTransaction as normalizeAdminTransaction, normalizeUser as normalizeAdminUser } from "./adminNormalizers.js";
import { addCalendarMonths, syncOrderWithCashfree } from "./payments.js";
import { readJson } from "./http.js";

const MAX_READ = 750;
const MAX_EXPORT = 1000;
const USER_STATUSES = ["active", "suspended", "blocked"];
const SUBSCRIPTION_STATUSES = ["pending", "active", "expired", "cancelled", "revoked"];
const ACCESS_SOURCES = ["cashfree_payment", "admin_granted", "complimentary", "migration"];
const MANUAL_ACCESS_SOURCES = ["admin_granted", "complimentary"];

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertPermission(admin, permission) {
  if (!hasPermission(admin, permission)) throw httpError("This administrator does not have permission for this action.", 403);
}

function cleanText(value, max = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function safeDocId(value) {
  return String(value || crypto.randomUUID()).replace(/[\/#?\[\]]/g, "_");
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

function daysRemaining(value) {
  const end = toDate(value);
  if (!end) return null;
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
}

function displayPlanName(value) {
  return value === "PICK UP" ? "PICK UP DAILY TARGETS" : value || "Unknown plan";
}

function getPlanSnapshot(variantId) {
  const selected = getVariant(variantId);
  return selected ? planSnapshot(selected.plan, selected.variant) : null;
}

function normalizePaymentStatus(value) {
  const text = String(value || "").toLowerCase();
  if (["success", "paid", "captured"].includes(text)) return "successful";
  if (text.includes("partial") && text.includes("refund")) return "partially_refunded";
  if (text.includes("refund")) return "refunded";
  if (text.includes("drop")) return "user_dropped";
  if (text.includes("cancel")) return "cancelled";
  if (text.includes("fail")) return "failed";
  return "pending";
}

function serializeSubscription(id, data, context = {}) {
  return normalizeAdminSubscription(id, data, context);
}

function serializeOrder(id, data) {
  return normalizeAdminOrder(id, data);
}

function serializePayment(id, data, context = {}) {
  return normalizeAdminTransaction(id, data, context);
}

function paginate(items, query) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const page = Math.max(Number(query.page || 1), 1);
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { page, pageSize, total, hasMore: start + pageSize < total, items: items.slice(start, start + pageSize) };
}

function contains(value, needle) {
  if (!needle) return true;
  return String(value || "").toLowerCase().includes(String(needle).toLowerCase());
}

function dateInRange(value, start, end) {
  const date = toDate(value);
  if (!date) return !start && !end;
  if (start && date < new Date(`${start}T00:00:00.000Z`)) return false;
  if (end && date > new Date(`${end}T23:59:59.999Z`)) return false;
  return true;
}

async function getStudentsById() {
  const snap = await getDb().collection("students").limit(MAX_READ).get();
  const map = new Map();
  snap.docs.forEach((doc) => map.set(doc.id, { id: doc.id, ...doc.data() }));
  return map;
}

function matchesAny(value, candidates) {
  return candidates.filter(Boolean).includes(value);
}

function rawDoc(doc) {
  return { id: doc.id, data: doc.data() };
}

function uniqueDocs(docs) {
  const seen = new Set();
  return docs.filter((doc) => {
    if (!doc || seen.has(doc.id)) return false;
    seen.add(doc.id);
    return true;
  });
}

function findLinkedOrder(subscription, orders) {
  if (!subscription?.orderId) return null;
  const match = orders.find((order) => matchesAny(subscription.orderId, [order.id, order.data.internalOrderNumber, order.data.merchantOrderId, order.data.cashfreeOrderId]));
  return match ? { id: match.id, ...match.data } : null;
}

function findLinkedPayment(subscription, payments) {
  const keys = [subscription?.paymentId, subscription?.transactionId, subscription?.orderId].filter(Boolean);
  if (!keys.length) return null;
  const match = payments.find((payment) => keys.some((key) => matchesAny(key, [payment.id, payment.data.cashfreePaymentId, payment.data.cfPaymentId, payment.data.providerPaymentId, payment.data.orderDocumentId, payment.data.merchantOrderId, payment.data.cashfreeOrderId])));
  return match ? { id: match.id, ...paymentSafeData(match.data) } : null;
}

function paymentSafeData(data) {
  return data || {};
}

function findSubscriptionForPayment(payment, subscriptions) {
  const data = payment?.data || {};
  const keys = [payment?.id, data.cashfreePaymentId, data.cfPaymentId, data.providerPaymentId, data.orderDocumentId, data.merchantOrderId, data.cashfreeOrderId].filter(Boolean);
  const match = subscriptions.find((subscription) => keys.some((key) => matchesAny(key, [subscription.id, subscription.data.paymentId, subscription.data.transactionId, subscription.data.cashfreePaymentId, subscription.data.orderId, subscription.data.orderDocumentId, subscription.data.merchantOrderId])));
  return match ? serializeSubscription(match.id, match.data) : null;
}

async function getSubscriptions() {
  const db = getDb();
  const [subsSnap, ordersSnap, paymentsSnap] = await Promise.all([
    db.collection("subscriptions").limit(MAX_READ).get(),
    db.collection("orders").limit(MAX_READ).get(),
    db.collection("payments").limit(MAX_READ).get()
  ]);
  const orders = ordersSnap.docs.map(rawDoc);
  const payments = paymentsSnap.docs.map(rawDoc);
  return subsSnap.docs.map((doc) => {
    const subscription = serializeSubscription(doc.id, doc.data());
    return serializeSubscription(doc.id, doc.data(), {
      order: findLinkedOrder(subscription, orders),
      payment: findLinkedPayment(subscription, payments)
    });
  });
}

async function getOrders() {
  const snap = await getDb().collection("orders").limit(MAX_READ).get();
  return snap.docs.map((doc) => serializeOrder(doc.id, doc.data()));
}

async function getPayments() {
  const db = getDb();
  const [paymentsSnap, subsSnap] = await Promise.all([
    db.collection("payments").limit(MAX_READ).get(),
    db.collection("subscriptions").limit(MAX_READ).get()
  ]);
  const subscriptions = subsSnap.docs.map(rawDoc);
  return paymentsSnap.docs.map((doc) => serializePayment(doc.id, doc.data(), { subscription: findSubscriptionForPayment(rawDoc(doc), subscriptions) }));
}

async function getActivity(entityType, entityId, limit = 50) {
  const snap = await getDb().collection("adminActivityLogs").limit(250).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: iso(doc.data().createdAt) }))
    .filter((item) => (!entityType || item.entityType === entityType) && (!entityId || item.entityId === entityId))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, limit);
}

async function listAuthUsers() {
  return (await getAuth(getAdminApp()).listUsers(1000)).users;
}

function mergeUser(authUser, student = {}, subscriptions = []) {
  return normalizeAdminUser(authUser, student, subscriptions);
}

export async function listUsers(admin, query) {
  assertPermission(admin, "users.view");
  const [authUsers, students, subscriptions] = await Promise.all([listAuthUsers(), getStudentsById(), getSubscriptions()]);
  let users = authUsers.map((user) => mergeUser(user, students.get(user.uid) || {}, subscriptions));
  const q = cleanText(query.q || query.search || "", 120);
  users = users.filter((user) => {
    if (q && ![user.displayName, user.email, user.phone].some((value) => contains(value, q))) return false;
    if (query.provider && user.provider !== query.provider) return false;
    if (query.verified === "verified" && !user.emailVerified) return false;
    if (query.verified === "unverified" && user.emailVerified) return false;
    if (query.status && user.accountStatus !== query.status) return false;
    if (query.subscriptionStatus === "active" && user.activeSubscriptionCount < 1) return false;
    if (query.subscriptionStatus === "none" && user.activeSubscriptionCount > 0) return false;
    if (query.plan && user.currentVariantId !== query.plan && user.currentPlan !== query.plan) return false;
    if (!dateInRange(user.createdAt, query.start, query.end)) return false;
    return true;
  });
  users.sort((a, b) => query.sort === "oldest" ? String(a.createdAt || "").localeCompare(String(b.createdAt || "")) : String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return { users: paginate(users, query), filters: { plans } };
}

export async function searchVerifiedUser(admin, query) {
  assertPermission(admin, "users.view");
  const result = await listUsers(admin, { q: query.email || query.q || "", pageSize: 10 });
  return { candidates: result.users.items.filter((user) => user.emailVerified) };
}

export async function getUserDetail(admin, uid) {
  assertPermission(admin, "users.view");
  const auth = getAuth(getAdminApp());
  const authUser = await auth.getUser(uid).catch(() => null);
  if (!authUser) throw httpError("User was not found.", 404);
  const db = getDb();
  const [studentSnap, subsUserSnap, subsUidSnap, ordersUserSnap, ordersUidSnap, paymentsUserSnap, paymentsUidSnap, logs, notesSnap] = await Promise.all([
    db.collection("students").doc(uid).get(),
    db.collection("subscriptions").where("userId", "==", uid).limit(100).get(),
    db.collection("subscriptions").where("uid", "==", uid).limit(100).get().catch(() => ({ docs: [] })),
    db.collection("orders").where("userId", "==", uid).limit(100).get(),
    db.collection("orders").where("uid", "==", uid).limit(100).get().catch(() => ({ docs: [] })),
    db.collection("payments").where("userId", "==", uid).limit(100).get(),
    db.collection("payments").where("uid", "==", uid).limit(100).get().catch(() => ({ docs: [] })),
    getActivity("user", uid),
    db.collection("adminNotes").where("entityType", "==", "user").where("entityId", "==", uid).limit(50).get().catch(() => ({ docs: [] }))
  ]);
  const subDocs = uniqueDocs([...subsUserSnap.docs, ...subsUidSnap.docs]);
  const orderDocs = uniqueDocs([...ordersUserSnap.docs, ...ordersUidSnap.docs]);
  const paymentDocs = uniqueDocs([...paymentsUserSnap.docs, ...paymentsUidSnap.docs]);
  const rawOrders = orderDocs.map(rawDoc);
  const rawPayments = paymentDocs.map(rawDoc);
  const subscriptions = subDocs.map((doc) => {
    const base = serializeSubscription(doc.id, doc.data());
    return serializeSubscription(doc.id, doc.data(), { order: findLinkedOrder(base, rawOrders), payment: findLinkedPayment(base, rawPayments) });
  });
  return {
    user: mergeUser(authUser, studentSnap.exists ? studentSnap.data() : {}, subscriptions),
    profile: studentSnap.exists ? studentSnap.data() : {},
    profileStatus: studentSnap.exists ? "complete" : "incomplete",
    subscriptions,
    orders: orderDocs.map((doc) => serializeOrder(doc.id, doc.data())),
    transactions: paymentDocs.map((doc) => serializePayment(doc.id, doc.data(), { subscription: findSubscriptionForPayment(rawDoc(doc), subDocs.map(rawDoc)) })),
    activity: logs,
    notes: notesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: iso(doc.data().createdAt) }))
  };
}

export async function updateUserProfile(admin, uid, body) {
  assertPermission(admin, "users.manage");
  const payload = {
    name: cleanText(body.name || body.displayName || "", 120),
    phone: cleanText(body.phone || "", 30),
    city: cleanText(body.city || "", 80),
    state: cleanText(body.state || "", 80),
    preferredLanguage: cleanText(body.preferredLanguage || "", 80),
    preparationLevel: cleanText(body.preparationLevel || "", 80),
    targetExam: cleanText(body.targetExam || "", 80),
    activeExams: Array.isArray(body.activeExams) ? body.activeExams.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 10) : []
  };
  await getDb().collection("students").doc(uid).set({ ...payload, updatedAt: serverTimestamp(), updatedByAdminUid: admin.uid }, { merge: true });
  await writeAdminActivityLog({ admin, action: "user.profile.update", entityType: "user", entityId: uid, safeMetadata: { fields: Object.keys(payload) } });
  return getUserDetail(admin, uid);
}

export async function updateUserStatus(admin, uid, body) {
  assertPermission(admin, "users.manage");
  const status = cleanText(body.status || "");
  const reason = cleanText(body.reason || "", 500);
  if (!USER_STATUSES.includes(status)) throw httpError("Invalid user status.", 400);
  if (!reason) throw httpError("Reason is required.", 400);
  await getAuth(getAdminApp()).updateUser(uid, { disabled: status === "blocked" });
  await getDb().collection("students").doc(uid).set({ accountStatus: status, statusReason: reason, statusUpdatedAt: serverTimestamp(), statusUpdatedBy: admin.uid, updatedAt: serverTimestamp() }, { merge: true });
  await writeAdminActivityLog({ admin, action: `user.${status}`, entityType: "user", entityId: uid, reason, safeMetadata: { status } });
  return getUserDetail(admin, uid);
}

export async function addAdminNote(admin, entityType, entityId, body) {
  assertPermission(admin, entityType === "user" ? "users.manage" : entityType === "subscription" ? "subscriptions.manage" : "payments.reconcile");
  const text = cleanText(body.text || body.note || "", 1000);
  if (text.length < 3) throw httpError("Note text is required.", 400);
  const ref = getDb().collection("adminNotes").doc();
  await ref.set({ entityType, entityId, text, createdBy: admin.uid, createdByEmail: admin.email, createdAt: serverTimestamp() });
  await writeAdminActivityLog({ admin, action: "admin.note.add", entityType, entityId, safeMetadata: { noteId: ref.id } });
  return { note: { id: ref.id, entityType, entityId, text, createdBy: admin.uid, createdAt: new Date().toISOString() } };
}

export async function listSubscriptions(admin, query) {
  assertPermission(admin, "subscriptions.view");
  let items = await getSubscriptions();
  const q = cleanText(query.q || query.search || "", 120);
  items = items.filter((item) => {
    if (q && ![item.studentName, item.userEmail, item.id, item.orderId].some((value) => contains(value, q))) return false;
    if (query.plan && item.variantId !== query.plan && item.planId !== query.plan) return false;
    if (query.duration && item.durationLabel !== query.duration) return false;
    if (query.status && item.status !== query.status) return false;
    if (query.source && item.source !== query.source) return false;
    if (query.expiry === "next_30" && !(item.daysRemaining !== null && item.daysRemaining <= 30)) return false;
    return true;
  });
  items.sort((a, b) => query.sort === "expiry" ? String(a.accessEndAt || "").localeCompare(String(b.accessEndAt || "")) : String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return { subscriptions: paginate(items, query), filters: { statuses: SUBSCRIPTION_STATUSES, sources: ACCESS_SOURCES, plans } };
}

export async function getSubscriptionDetail(admin, id) {
  assertPermission(admin, "subscriptions.view");
  if (!cleanText(id, 220)) throw httpError("Subscription id is required.", 400);
  const db = getDb();
  const snap = await db.collection("subscriptions").doc(id).get();
  if (!snap.exists) throw httpError("Subscription was not found.", 404);
  const base = serializeSubscription(snap.id, snap.data());
  const [user, orderSnap, paymentSnap, logs, notesSnap] = await Promise.all([
    base.userId ? getUserDetail(admin, base.userId).catch(() => null) : null,
    base.orderId ? db.collection("orders").doc(base.orderId).get().catch(() => null) : null,
    base.paymentId ? db.collection("payments").doc(base.paymentId).get().catch(() => null) : null,
    getActivity("subscription", id),
    db.collection("adminNotes").where("entityType", "==", "subscription").where("entityId", "==", id).limit(50).get().catch(() => ({ docs: [] }))
  ]);
  const order = orderSnap?.exists ? { id: orderSnap.id, ...orderSnap.data() } : null;
  const payment = paymentSnap?.exists ? { id: paymentSnap.id, ...paymentSnap.data() } : null;
  const subscription = serializeSubscription(snap.id, snap.data(), { order, payment });
  return {
    subscription,
    user: user?.user || null,
    orders: order ? [serializeOrder(orderSnap.id, orderSnap.data())] : [],
    transactions: payment ? [serializePayment(paymentSnap.id, paymentSnap.data(), { subscription })] : [],
    linkedOrderMissing: Boolean(base.orderId && !order),
    linkedTransactionMissing: Boolean(base.paymentId && !payment),
    activity: logs,
    notes: notesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: iso(doc.data().createdAt) }))
  };
}

export async function grantSubscription(admin, body) {
  assertPermission(admin, "subscriptions.manage");
  const uid = cleanText(body.userId || body.uid, 160);
  const variantId = cleanText(body.variantId, 80);
  const source = cleanText(body.source || "admin_granted", 40);
  const reason = cleanText(body.reason || "", 500);
  if (!uid || !variantId) throw httpError("User and plan duration are required.", 400);
  if (!MANUAL_ACCESS_SOURCES.includes(source)) throw httpError("Invalid manual access source.", 400);
  if (!reason) throw httpError("Reason is required.", 400);
  const selected = getVariant(variantId);
  if (!selected) throw httpError("Invalid plan duration.", 400);
  const authUser = await getAuth(getAdminApp()).getUser(uid).catch(() => null);
  if (!authUser) throw httpError("User was not found.", 404);
  if (!authUser.emailVerified) throw httpError("Manual grants require a verified Firebase user.", 400);
  const snapshot = planSnapshot(selected.plan, selected.variant);
  const start = body.startDate ? new Date(`${body.startDate}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(start.getTime())) throw httpError("Invalid access start date.", 400);
  const end = addCalendarMonths(start, snapshot.durationMonths);
  const db = getDb();
  const active = await db.collection("subscriptions").where("userId", "==", uid).where("variantId", "==", variantId).where("status", "==", "active").limit(1).get();
  if (!active.empty && !body.confirmSeparateEntitlement) throw httpError("User already has this active plan. Extend it or confirm a separate entitlement.", 409);
  const ref = db.collection("subscriptions").doc(`manual_${safeDocId(uid)}_${safeDocId(variantId)}_${Date.now()}`);
  await ref.set({ userId: uid, userEmail: authUser.email || "", studentName: authUser.displayName || authUser.email || "Student", planId: snapshot.planId, variantId: snapshot.variantId, planName: snapshot.name, durationLabel: snapshot.durationLabel, amountPaid: 0, currency: "INR", status: "active", source, accessTags: snapshot.accessTags || [], accessStartAt: start, accessEndAt: end, grantedBy: admin.uid, grantReason: reason, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await writeAdminActivityLog({ admin, action: "subscription.grant", entityType: "subscription", entityId: ref.id, reason, safeMetadata: { userId: uid, variantId, source } });
  return getSubscriptionDetail(admin, ref.id);
}

async function mutateSubscription(admin, id, action, body) {
  assertPermission(admin, "subscriptions.manage");
  const reason = cleanText(body.reason || "", 500);
  if (!reason) throw httpError("Reason is required.", 400);
  const db = getDb();
  const ref = db.collection("subscriptions").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw httpError("Subscription was not found.", 404);
  const current = serializeSubscription(id, snap.data());
  const update = { updatedAt: serverTimestamp(), updatedBy: admin.uid };
  if (action === "extend") {
    const selected = body.variantId ? getVariant(body.variantId) : getVariant(current.variantId);
    const customDays = Number(body.days || 0);
    if (!selected && !(admin.role === "super_admin" && customDays > 0)) throw httpError("Select a valid extension duration.", 400);
    const base = current.status === "active" && toDate(current.accessEndAt) && toDate(current.accessEndAt) > new Date() ? toDate(current.accessEndAt) : (body.startDate ? new Date(`${body.startDate}T00:00:00.000Z`) : new Date());
    const nextEnd = selected ? addCalendarMonths(base, selected.variant.durationMonths) : new Date(base.getTime() + customDays * 86400000);
    Object.assign(update, { status: "active", accessStartAt: toDate(current.accessStartAt) || base, accessEndAt: nextEnd, extensionReason: reason });
  } else if (action === "cancel") {
    Object.assign(update, { status: "cancelled", cancellationReason: reason, cancelledBy: admin.uid, cancelledAt: serverTimestamp() });
  } else if (action === "revoke") {
    Object.assign(update, { status: "revoked", accessEndAt: new Date(), revocationReason: reason, revokedBy: admin.uid, revokedAt: serverTimestamp() });
  } else if (action === "reactivate") {
    const selected = body.variantId ? getVariant(body.variantId) : getVariant(current.variantId);
    if (!selected) throw httpError("Select a valid reactivation duration.", 400);
    const start = new Date();
    Object.assign(update, { status: "active", accessStartAt: start, accessEndAt: addCalendarMonths(start, selected.variant.durationMonths), reactivationReason: reason, reactivatedBy: admin.uid, reactivatedAt: serverTimestamp() });
  }
  await ref.set(update, { merge: true });
  await writeAdminActivityLog({ admin, action: `subscription.${action}`, entityType: "subscription", entityId: id, reason, safeMetadata: { previousStatus: current.status, newStatus: update.status || current.status } });
  return getSubscriptionDetail(admin, id);
}

export const extendSubscription = (admin, id, body) => mutateSubscription(admin, id, "extend", body);
export const cancelSubscription = (admin, id, body) => mutateSubscription(admin, id, "cancel", body);
export const revokeSubscription = (admin, id, body) => mutateSubscription(admin, id, "revoke", body);
export const reactivateSubscription = (admin, id, body) => mutateSubscription(admin, id, "reactivate", body);

export async function listOrders(admin, query) {
  assertPermission(admin, "orders.view");
  let items = await getOrders();
  const q = cleanText(query.q || query.search || "", 120);
  items = items.filter((item) => {
    if (q && ![item.internalOrderId, item.cashfreeOrderId, item.userEmail, item.studentName].some((value) => contains(value, q))) return false;
    if (query.status && item.orderStatus !== query.status && item.paymentStatus !== query.status) return false;
    if (query.plan && item.variantId !== query.plan && item.planId !== query.plan) return false;
    if (query.minAmount && item.expectedAmount < Number(query.minAmount)) return false;
    if (query.maxAmount && item.expectedAmount > Number(query.maxAmount)) return false;
    if (!dateInRange(item.createdAt, query.start, query.end)) return false;
    return true;
  });
  items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return { orders: paginate(items, query), filters: { plans } };
}

export async function getOrderDetail(admin, id) {
  assertPermission(admin, "orders.view");
  const db = getDb();
  const snap = await db.collection("orders").doc(id).get();
  if (!snap.exists) throw httpError("Order was not found.", 404);
  const order = serializeOrder(snap.id, snap.data());
  const [subsSnap, paymentsSnap, logs] = await Promise.all([db.collection("subscriptions").where("orderId", "==", id).limit(20).get(), db.collection("payments").where("orderDocumentId", "==", id).limit(20).get(), getActivity("order", id)]);
  return { order, subscriptions: subsSnap.docs.map((doc) => serializeSubscription(doc.id, doc.data())), transactions: paymentsSnap.docs.map((doc) => serializePayment(doc.id, doc.data())), activity: logs, warnings: await consistencyWarnings({ orders: [order] }) };
}

export async function listTransactions(admin, query) {
  assertPermission(admin, hasPermission(admin, "payments.view") ? "payments.view" : "payments.view_limited");
  let items = await getPayments();
  const q = cleanText(query.q || query.search || "", 120);
  items = items.filter((item) => {
    if (q && ![item.id, item.cashfreePaymentId, item.cashfreeOrderId, item.internalOrderId, item.userEmail].some((value) => contains(value, q))) return false;
    if (query.status && item.normalizedStatus !== query.status) return false;
    if (query.plan && item.variantId !== query.plan && item.planId !== query.plan) return false;
    if (!dateInRange(item.createdAt || item.capturedAt, query.start, query.end)) return false;
    return true;
  });
  items.sort((a, b) => String(b.createdAt || b.capturedAt || "").localeCompare(String(a.createdAt || a.capturedAt || "")));
  return { transactions: paginate(items, query), filters: { plans } };
}

export async function getTransactionDetail(admin, id) {
  assertPermission(admin, hasPermission(admin, "payments.view") ? "payments.view" : "payments.view_limited");
  if (!cleanText(id, 220)) throw httpError("Transaction id is required.", 400);
  const db = getDb();
  const snap = await db.collection("payments").doc(id).get();
  if (!snap.exists) throw httpError("Transaction was not found.", 404);
  const rawPayment = rawDoc(snap);
  const paymentData = snap.data();
  const keys = [snap.id, paymentData.cashfreePaymentId, paymentData.cfPaymentId, paymentData.providerPaymentId, paymentData.orderDocumentId, paymentData.merchantOrderId, paymentData.cashfreeOrderId].filter(Boolean);
  const [subsSnap, logs] = await Promise.all([
    db.collection("subscriptions").limit(MAX_READ).get(),
    getActivity("transaction", id)
  ]);
  const linkedSubscription = findSubscriptionForPayment(rawPayment, subsSnap.docs.map(rawDoc));
  const transaction = serializePayment(snap.id, paymentData, { subscription: linkedSubscription });
  const timeline = [
    transaction.createdAt && { label: "Payment record created", at: transaction.createdAt },
    transaction.webhookVerified && { label: "Webhook signature verified", at: transaction.updatedAt || transaction.createdAt },
    transaction.verified && { label: "Payment verified server-side", at: transaction.capturedAt || transaction.updatedAt },
    transaction.subscriptionActivated && { label: "Subscription activated", at: transaction.updatedAt },
    transaction.lastReconciledAt && { label: "Payment reconciled", at: transaction.lastReconciledAt }
  ].filter(Boolean);
  return { transaction, subscription: linkedSubscription, lookupKeys: keys, timeline, activity: logs };
}

export async function reconcileTransaction(admin, id) {
  assertPermission(admin, "payments.reconcile");
  const db = getDb();
  const paymentSnap = await db.collection("payments").doc(id).get();
  const orderId = paymentSnap.exists ? (paymentSnap.data().orderDocumentId || paymentSnap.data().merchantOrderId) : id;
  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) throw httpError("Order for reconciliation was not found.", 404);
  const before = serializeOrder(orderSnap.id, orderSnap.data());
  const result = await syncOrderWithCashfree(orderSnap.ref, "admin_reconciliation");
  await orderSnap.ref.set({ lastReconciledAt: serverTimestamp(), reconciledBy: admin.uid }, { merge: true });
  if (paymentSnap.exists) await paymentSnap.ref.set({ lastReconciledAt: serverTimestamp(), reconciledBy: admin.uid }, { merge: true });
  await writeAdminActivityLog({ admin, action: "payment.reconcile", entityType: "order", entityId: orderSnap.id, safeMetadata: { before: before.paymentStatus, after: result.status } });
  return { reconciliation: result };
}

export async function consistencyWarnings(scope = {}) {
  const [orders, subscriptions, payments] = await Promise.all([scope.orders || getOrders(), scope.subscriptions || getSubscriptions(), scope.payments || getPayments()]);
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const activeSubs = subscriptions.filter((sub) => sub.status === "active");
  const seenPayments = new Set();
  const warnings = [];
  payments.forEach((payment) => {
    const id = payment.cashfreePaymentId || payment.id;
    if (id && seenPayments.has(id)) warnings.push({ type: "duplicate_successful_payment_id", entityType: "transaction", entityId: id });
    if (id) seenPayments.add(id);
  });
  paidOrders.forEach((order) => {
    if (!activeSubs.some((sub) => sub.orderId === order.id || sub.orderId === order.internalOrderId)) warnings.push({ type: "paid_order_without_subscription", entityType: "order", entityId: order.id });
    if (!getVariant(order.variantId)) warnings.push({ type: "unknown_plan_id", entityType: "order", entityId: order.id });
  });
  activeSubs.forEach((sub) => {
    if (toDate(sub.accessEndAt) && toDate(sub.accessStartAt) && toDate(sub.accessEndAt) < toDate(sub.accessStartAt)) warnings.push({ type: "subscription_end_before_start", entityType: "subscription", entityId: sub.id });
    if (sub.source === "cashfree_payment" && !payments.some((payment) => payment.verified && (payment.orderDocumentId === sub.orderId || payment.internalOrderId === sub.orderId))) warnings.push({ type: "active_paid_subscription_without_verified_payment", entityType: "subscription", entityId: sub.id });
  });
  return warnings;
}

function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}

export async function exportReport(admin, reportType, query) {
  assertPermission(admin, "reports.export");
  let data;
  if (reportType === "users") data = (await listUsers(admin, { ...query, pageSize: MAX_EXPORT })).users.items;
  else if (reportType === "subscriptions") data = (await listSubscriptions(admin, { ...query, pageSize: MAX_EXPORT })).subscriptions.items;
  else if (reportType === "orders") data = (await listOrders(admin, { ...query, pageSize: MAX_EXPORT })).orders.items;
  else if (reportType === "transactions") data = (await listTransactions(admin, { ...query, pageSize: MAX_EXPORT })).transactions.items;
  else throw httpError("Unsupported export type.", 400);
  const safeRows = data.slice(0, MAX_EXPORT).map((item) => {
    const row = {};
    Object.entries(item).forEach(([key, value]) => {
      if (!/token|secret|payload|password|credential/i.test(key)) row[key] = Array.isArray(value) ? value.join("; ") : value;
    });
    return row;
  });
  await writeAdminActivityLog({ admin, action: "report.export", entityType: "report", entityId: reportType, safeMetadata: { count: safeRows.length } });
  return { filename: `delight-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`, contentType: "text/csv; charset=utf-8", body: toCsv(safeRows) };
}

export async function readBody(req) {
  return readJson(req);
}

export { plans, getPlanSnapshot };










