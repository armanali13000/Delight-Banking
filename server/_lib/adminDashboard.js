import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("../../data/plans.json", import.meta.url), "utf8"));
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getDb } from "./firebaseAdmin.js";

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

function istDateKey(date) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: IST_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); const value = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${value.year}-${value.month}-${value.day}`; }
function startOfDay(date) { return new Date(`${istDateKey(date)}T00:00:00+05:30`); }
function monthStart(date,offset=0){const [year,month]=istDateKey(date).split("-").map(Number),target=new Date(Date.UTC(year,month-1+offset,1)),key=`${target.getUTCFullYear()}-${String(target.getUTCMonth()+1).padStart(2,"0")}-01`;return new Date(`${key}T00:00:00+05:30`)}
function monthEnd(date,offset=0){return new Date(monthStart(date,offset+1).getTime()-1)}
function endOfDay(date) { return new Date(`${istDateKey(date)}T23:59:59.999+05:30`); }

function resolveRange(query = {}) {
  const now = new Date();
  const range = String(query.range || "last_30_days");
  if (range === "all_time") return { range, start: null, end: now, label: "All time", timezone: IST_TIMEZONE };
  if (range === "today") return { range, start: startOfDay(now), end: endOfDay(now), label: "Today", timezone: IST_TIMEZONE };
  if (range === "last_7_days") return { range, start: startOfDay(new Date(now.getTime() - 6 * DAY_MS)), end: endOfDay(now), label: "Last 7 days", timezone: IST_TIMEZONE };
  if (range === "this_month") return { range, start: monthStart(now), end: endOfDay(now), label: "This month", timezone: IST_TIMEZONE };
  if (range === "previous_month") return { range, start: monthStart(now,-1), end: monthEnd(now,-1), label: "Previous month", timezone: IST_TIMEZONE };
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

function bucketKey(value, range) { const date=toDate(value); if(!date)return ""; if(range.range==="today")return new Intl.DateTimeFormat("en-IN",{timeZone:IST_TIMEZONE,hour:"numeric"}).format(date); const span=range.start?(range.end-range.start)/DAY_MS:Infinity; if(span<=62)return new Intl.DateTimeFormat("en-IN",{timeZone:IST_TIMEZONE,day:"2-digit",month:"short"}).format(date); return new Intl.DateTimeFormat("en-IN",{timeZone:IST_TIMEZONE,month:"short",year:"numeric"}).format(date) }
function flowSeries(records,dateOf,range,predicate=()=>true,valueOf=()=>1){const points=new Map();records.filter(item=>predicate(item)&&inRange(dateOf(item),range)).sort((a,b)=>(toDate(dateOf(a))?.getTime()||0)-(toDate(dateOf(b))?.getTime()||0)).forEach(item=>{const label=bucketKey(dateOf(item),range);if(label)points.set(label,(points.get(label)||0)+valueOf(item))});return[...points.entries()].map(([label,value])=>({label,value}))}
const metricDefinitions=[["totalRegisteredUsers","Total registered users","count","stock"],["newUsers","New users","count","flow"],["passwordUsers","Email/password users","count","stock"],["googleUsers","Google-login users","count","stock"],["verifiedUsers","Verified users","count","stock"],["activeSubscriptions","Active subscriptions","count","stock"],["expiringSubscriptions","Expiring subscriptions","count","stock"],["expiredSubscriptions","Expired subscriptions","count","stock"],["successfulPayments","Successful payments","count","flow"],["pendingPayments","Pending payments","count","flow"],["failedPayments","Failed payments","count","flow"],["cancelledPayments","Cancelled/user-dropped payments","count","flow"],["totalVerifiedRevenue","Total verified revenue","currency","flow"],["refunds","Refunds","currency","flow"],["activeAdministrators","Active administrators","count","stock"]].map(([key,label,unit,kind])=>({key,label,unit,kind}));
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

async function listAuthUsers() { const auth = getAuth(getAdminApp()), users = []; let pageToken; do { const page = await auth.listUsers(1000, pageToken); users.push(...page.users); pageToken = page.pageToken; } while (pageToken); return users; }
function authProvider(user) { return user.providerData?.some((item) => item.providerId === "google.com") ? "google.com" : user.providerData?.some((item) => item.providerId === "password") ? "password" : "unknown"; }
function authCreatedAt(user) { return toDate(user.metadata?.creationTime); }
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
  const [authUsers, studentsSnap, ordersSnap, paymentsSnap, subscriptionsSnap, adminsSnap] = await Promise.all([
    listAuthUsers(),
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

  const authUsersAsOfEnd = authUsers.filter((item) => !range.end || authCreatedAt(item) <= range.end);
  const scopedAuthUsers = authUsersAsOfEnd.filter((item) => inRange(authCreatedAt(item), range));
  const scopedOrders = orders.filter((item) => inRange(item.createdAt || item.updatedAt, range));
  const scopedPayments = payments.filter((item) => inRange(item.capturedAt || item.createdAt || item.updatedAt, range));
  const now = new Date(), stockAt = range.end || now;
  const activeSubscriptions = subscriptions.filter((item) => item.status === "active" && (!toDate(item.accessStartAt) || toDate(item.accessStartAt) <= stockAt) && (!toDate(item.accessEndAt) || toDate(item.accessEndAt) > stockAt));
  const expiredSubscriptions = subscriptions.filter((item) => toDate(item.accessEndAt) && toDate(item.accessEndAt) <= stockAt);
  const expiringSubscriptions = activeSubscriptions.filter((item) => toDate(item.accessEndAt) && toDate(item.accessEndAt) <= new Date(stockAt.getTime() + 30 * DAY_MS));
  const verifiedPayments = scopedPayments.filter((item) => item.verified === true && statusOf(item.status) === "paid");
  const refundPayments = scopedPayments.filter((item) => item.refundAmount || statusOf(item.status).includes("refund"));

  const paymentDistributionMap = new Map([["paid", 0], ["pending", 0], ["failed", 0], ["cancelled", 0], ["user_dropped", 0], ["refunded", 0], ["partially_refunded", 0]]);
  scopedOrders.forEach((item) => paymentDistributionMap.set(statusOf(item.paymentStatus || item.orderStatus), (paymentDistributionMap.get(statusOf(item.paymentStatus || item.orderStatus)) || 0) + 1));
  scopedPayments.forEach((item) => paymentDistributionMap.set(statusOf(item.status), (paymentDistributionMap.get(statusOf(item.status)) || 0) + 1));

  const userGrowth = new Map();
  scopedAuthUsers.forEach((item) => userGrowth.set(monthKey(authCreatedAt(item)), (userGrowth.get(monthKey(authCreatedAt(item))) || 0) + 1));
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

  const analyticsSeries = {
    totalRegisteredUsers:{available:false,reason:"Historical stock snapshots were not recorded."},newUsers:{available:true,points:flowSeries(authUsersAsOfEnd,authCreatedAt,range)},passwordUsers:{available:false,reason:"Historical linked-provider snapshots were not recorded."},googleUsers:{available:false,reason:"Historical linked-provider snapshots were not recorded."},verifiedUsers:{available:false,reason:"Historical verification-change timestamps were not recorded."},activeSubscriptions:{available:false,reason:"Historical subscription stock snapshots were not recorded."},expiringSubscriptions:{available:false,reason:"Historical subscription stock snapshots were not recorded."},expiredSubscriptions:{available:false,reason:"Historical subscription stock snapshots were not recorded."},successfulPayments:{available:true,points:flowSeries(payments,item=>item.capturedAt||item.createdAt,range,item=>item.verified===true&&statusOf(item.status)==="paid")},pendingPayments:{available:true,points:flowSeries(orders,item=>item.createdAt||item.updatedAt,range,item=>statusOf(item.paymentStatus||item.orderStatus)==="pending")},failedPayments:{available:true,points:flowSeries(orders,item=>item.createdAt||item.updatedAt,range,item=>statusOf(item.paymentStatus||item.orderStatus)==="failed")},cancelledPayments:{available:true,points:flowSeries(orders,item=>item.createdAt||item.updatedAt,range,item=>["cancelled","user_dropped"].includes(statusOf(item.paymentStatus||item.orderStatus)))},totalVerifiedRevenue:{available:true,points:flowSeries(payments,item=>item.capturedAt||item.createdAt,range,item=>item.verified===true&&statusOf(item.status)==="paid",item=>amount(item.amountInRupees??item.amount))},refunds:{available:true,points:flowSeries(payments,item=>item.updatedAt||item.createdAt,range,item=>item.refundAmount||statusOf(item.status).includes("refund"),item=>amount(item.refundAmount))},activeAdministrators:{available:false,reason:"Historical administrator stock snapshots were not recorded."}
  };

  return {
    range,
    analytics:{definitions:metricDefinitions,series:analyticsSeries},
    summary: {
      totalRegisteredUsers: authUsersAsOfEnd.length,
      newUsers: scopedAuthUsers.length,
      passwordUsers: authUsersAsOfEnd.filter((item) => authProvider(item) === "password").length,
      googleUsers: authUsersAsOfEnd.filter((item) => authProvider(item) === "google.com").length,
      verifiedUsers: authUsersAsOfEnd.filter((item) => item.emailVerified).length,
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
    recentUsers: authUsersAsOfEnd.map((user) => { const profile = byUser.get(user.uid) || {}; return { uid: user.uid, displayName: profile.name || profile.fullName || user.displayName || user.email || "Incomplete profile", email: user.email || "", photoURL: profile.photoURL || user.photoURL || "", provider: authProvider(user), emailVerified: Boolean(user.emailVerified), createdAt: serializeDate(authCreatedAt(user)), subscriptionSummary: subscriptions.some((item) => (item.userId || item.uid) === user.uid && item.status === "active") ? "Active subscription" : "No active subscription" }; }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || String(a.uid).localeCompare(String(b.uid))).slice(0, 10),
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