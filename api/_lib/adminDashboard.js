import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("../../data/plans.json", import.meta.url), "utf8"));
import { getDb } from "./firebaseAdmin.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_TIMEZONE = "Asia/Kolkata";

function serializeDate(value) {
  return value?.toDate ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value || null;
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function resolveRange(query = {}) {
  const now = new Date();
  const range = String(query.range || "last_30_days");
  if (range === "all_time") return { range, start: null, end: now, label: "All time", timezone: IST_TIMEZONE };
  if (range === "today") return { range, start: startOfDay(now), end: endOfDay(now), label: "Today", timezone: IST_TIMEZONE };
  if (range === "last_7_days") return { range, start: startOfDay(new Date(now.getTime() - 6 * DAY_MS)), end: endOfDay(now), label: "Last 7 days", timezone: IST_TIMEZONE };
  if (range === "this_month") return { range, start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now), label: "This month", timezone: IST_TIMEZONE };
  if (range === "previous_month") return { range, start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)), label: "Previous month", timezone: IST_TIMEZONE };
  if (range === "custom") {
    const start = toDate(query.start);
    const end = toDate(query.end);
    if (!start || !end || start > end) {
      const error = new Error("Choose a valid dashboard date range.");
      error.statusCode = 400;
      throw error;
    }
    return { range, start: startOfDay(start), end: endOfDay(end), label: "Custom range", timezone: IST_TIMEZONE };
  }
  return { range: "last_30_days", start: startOfDay(new Date(now.getTime() - 29 * DAY_MS)), end: endOfDay(now), label: "Last 30 days", timezone: IST_TIMEZONE };
}

function inRange(value, range) {
  const date = toDate(value);
  if (!date) return false;
  if (range.start && date < range.start) return false;
  return !range.end || date <= range.end;
}

function monthKey(value) {
  const date = toDate(value) || new Date(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function amount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function statusOf(value) {
  const status = String(value || "pending").toLowerCase();
  if (["success", "paid"].includes(status)) return "paid";
  if (["cancelled", "canceled", "user_dropped", "no_payment_attempt", "expired"].includes(status)) return status === "user_dropped" ? "user_dropped" : "cancelled";
  if (status.includes("refund")) return status.includes("partial") ? "partially_refunded" : "refunded";
  if (status === "failed") return "failed";
  return "pending";
}

function planKey(planId, variantId) {
  return `${planId || "unknown"}:${variantId || "unknown"}`;
}

function planCatalogRows() {
  return catalog.plans.flatMap((plan) => plan.variants.map((variant) => ({
    key: planKey(plan.planId, variant.variantId),
    planId: plan.planId,
    variantId: variant.variantId,
    planName: plan.planId === "pickup" ? "PICK UP DAILY TARGETS" : plan.name.toUpperCase(),
    durationLabel: variant.durationLabel,
    trustedPriceInRupees: variant.priceInRupees,
    verifiedPurchases: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    verifiedRevenue: 0,
    refundAmount: 0,
    netVerifiedRevenue: 0
  })));
}

function userProvider(user) {
  const provider = String(user.provider || user.signInProvider || user.providerId || "").toLowerCase();
  if (provider.includes("google")) return "google.com";
  if (provider.includes("password")) return "password";
  return provider || "unknown";
}

function safeUser(doc) {
  const data = doc.data() || {};
  return {
    uid: data.uid || doc.id,
    displayName: data.name || data.displayName || data.email || "Incomplete profile",
    email: data.email || "",
    photoURL: data.photo || data.photoURL || "",
    provider: userProvider(data),
    emailVerified: Boolean(data.emailVerified),
    createdAt: serializeDate(data.createdAt || data.lastSeenAt),
    subscriptionSummary: data.subscriptionSummary || "No active subscription"
  };
}

export async function getAdminDashboardOverview(query = {}) {
  const range = resolveRange(query);
  const db = getDb();
  const [studentsSnap, ordersSnap, paymentsSnap, subscriptionsSnap, adminsSnap] = await Promise.all([
    db.collection("students").limit(500).get(),
    db.collection("orders").limit(500).get(),
    db.collection("payments").limit(500).get(),
    db.collection("subscriptions").limit(500).get(),
    db.collection("adminUsers").limit(250).get()
  ]);

  const students = studentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const orders = ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const payments = paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const subscriptions = subscriptionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const admins = adminsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const scopedStudents = students.filter((item) => inRange(item.createdAt || item.lastSeenAt, range));
  const scopedOrders = orders.filter((item) => inRange(item.createdAt || item.updatedAt, range));
  const scopedPayments = payments.filter((item) => inRange(item.capturedAt || item.createdAt || item.updatedAt, range));
  const now = new Date();
  const activeSubscriptions = subscriptions.filter((item) => item.status === "active" && (!toDate(item.accessEndAt) || toDate(item.accessEndAt) > now));
  const expiredSubscriptions = subscriptions.filter((item) => toDate(item.accessEndAt) && toDate(item.accessEndAt) <= now);
  const expiringSubscriptions = activeSubscriptions.filter((item) => toDate(item.accessEndAt) && toDate(item.accessEndAt) <= new Date(now.getTime() + 30 * DAY_MS));
  const verifiedPayments = scopedPayments.filter((item) => item.verified === true && statusOf(item.status) === "paid");
  const refundPayments = scopedPayments.filter((item) => item.refundAmount || statusOf(item.status).includes("refund"));

  const paymentDistributionMap = new Map([["paid", 0], ["pending", 0], ["failed", 0], ["cancelled", 0], ["user_dropped", 0], ["refunded", 0], ["partially_refunded", 0]]);
  scopedOrders.forEach((item) => paymentDistributionMap.set(statusOf(item.paymentStatus || item.orderStatus), (paymentDistributionMap.get(statusOf(item.paymentStatus || item.orderStatus)) || 0) + 1));
  scopedPayments.forEach((item) => paymentDistributionMap.set(statusOf(item.status), (paymentDistributionMap.get(statusOf(item.status)) || 0) + 1));

  const userGrowth = new Map();
  scopedStudents.forEach((item) => userGrowth.set(monthKey(item.createdAt || item.lastSeenAt), (userGrowth.get(monthKey(item.createdAt || item.lastSeenAt)) || 0) + 1));
  const revenueGrowth = new Map();
  verifiedPayments.forEach((item) => revenueGrowth.set(monthKey(item.capturedAt || item.createdAt), (revenueGrowth.get(monthKey(item.capturedAt || item.createdAt)) || 0) + amount(item.amountInRupees ?? item.amount)));

  const performance = new Map(planCatalogRows().map((row) => [row.key, row]));
  verifiedPayments.forEach((item) => {
    const key = planKey(item.planId, item.variantId);
    const row = performance.get(key) || { key, planId: item.planId || "unknown", variantId: item.variantId || "unknown", planName: item.planId || "Unknown", durationLabel: "Unknown", trustedPriceInRupees: 0, verifiedPurchases: 0, activeSubscriptions: 0, expiredSubscriptions: 0, verifiedRevenue: 0, refundAmount: 0, netVerifiedRevenue: 0 };
    row.verifiedPurchases += 1;
    row.verifiedRevenue += amount(item.amountInRupees ?? item.amount);
    performance.set(key, row);
  });
  subscriptions.forEach((item) => {
    const key = planKey(item.planId, item.variantId);
    const row = performance.get(key);
    if (!row) return;
    if (activeSubscriptions.includes(item)) row.activeSubscriptions += 1;
    if (expiredSubscriptions.includes(item)) row.expiredSubscriptions += 1;
  });
  refundPayments.forEach((item) => {
    const row = performance.get(planKey(item.planId, item.variantId));
    if (row) row.refundAmount += amount(item.refundAmount);
  });
  performance.forEach((row) => { row.netVerifiedRevenue = row.verifiedRevenue - row.refundAmount; });

  const byUser = new Map(students.map((item) => [item.uid || item.id, item]));
  const recentTransactions = scopedOrders.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)).slice(0, 10).map((item) => ({
    id: item.id,
    internalOrderId: item.internalOrderNumber || item.id,
    cashfreeOrderId: item.cashfreeOrderId || "",
    userName: byUser.get(item.userId)?.name || byUser.get(item.userId)?.displayName || item.billing?.name || item.userEmail || "Unknown user",
    userEmail: item.userEmail || "",
    planName: item.trustedPlanSnapshot?.name || item.planId || "Unknown plan",
    durationLabel: item.trustedPlanSnapshot?.durationLabel || "",
    amountInRupees: amount(item.amountInRupees ?? item.amount),
    status: statusOf(item.paymentStatus || item.orderStatus),
    paymentMethod: item.paymentMethod || "Secure Payment",
    createdAt: serializeDate(item.createdAt),
    verifiedAt: serializeDate(item.paidAt)
  }));

  return {
    range,
    summary: {
      totalRegisteredUsers: students.length,
      newUsers: scopedStudents.length,
      passwordUsers: students.filter((item) => userProvider(item) === "password").length,
      googleUsers: students.filter((item) => userProvider(item) === "google.com").length,
      verifiedUsers: students.filter((item) => item.emailVerified).length,
      activeSubscriptions: activeSubscriptions.length,
      expiringSubscriptions: expiringSubscriptions.length,
      expiredSubscriptions: expiredSubscriptions.length,
      successfulPayments: verifiedPayments.length,
      pendingPayments: scopedOrders.filter((item) => statusOf(item.paymentStatus || item.orderStatus) === "pending").length,
      failedPayments: scopedOrders.filter((item) => statusOf(item.paymentStatus || item.orderStatus) === "failed").length,
      cancelledPayments: scopedOrders.filter((item) => ["cancelled", "user_dropped"].includes(statusOf(item.paymentStatus || item.orderStatus))).length,
      totalVerifiedRevenue: verifiedPayments.reduce((sum, item) => sum + amount(item.amountInRupees ?? item.amount), 0),
      refunds: refundPayments.reduce((sum, item) => sum + amount(item.refundAmount), 0),
      activeAdministrators: admins.filter((item) => item.status === "active").length
    },
    userGrowth: [...userGrowth.entries()].sort().map(([label, value]) => ({ label, value })),
    revenueGrowth: [...revenueGrowth.entries()].sort().map(([label, value]) => ({ label, value })),
    paymentDistribution: [...paymentDistributionMap.entries()].map(([label, value]) => ({ label, value })),
    planPerformance: [...performance.values()],
    recentUsers: studentsSnap.docs.map(safeUser).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 10),
    recentTransactions,
    expiringSubscriptions: expiringSubscriptions.sort((a, b) => (toDate(a.accessEndAt)?.getTime() || 0) - (toDate(b.accessEndAt)?.getTime() || 0)).slice(0, 10).map((item) => ({
      id: item.id,
      userId: item.userId || "",
      student: byUser.get(item.userId)?.name || byUser.get(item.userId)?.displayName || item.userEmail || "Unknown student",
      planName: item.planName || item.planId || "Unknown plan",
      durationLabel: item.durationLabel || "",
      accessStartAt: serializeDate(item.accessStartAt),
      accessEndAt: serializeDate(item.accessEndAt),
      daysRemaining: Math.max(0, Math.ceil(((toDate(item.accessEndAt)?.getTime() || now.getTime()) - now.getTime()) / DAY_MS)),
      status: toDate(item.accessEndAt) && toDate(item.accessEndAt) <= now ? "expired" : "active"
    }))
  };
}