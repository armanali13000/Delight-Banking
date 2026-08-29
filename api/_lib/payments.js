import crypto from "node:crypto";
import { fieldValue, getDb, serverTimestamp } from "./firebaseAdmin.js";
import { getVariant, planSnapshot } from "./plans.js";
import {
  createCashfreeOrder,
  fetchCashfreeOrder,
  fetchCashfreePayments,
  getCashfreeMode,
  verifyCashfreeWebhookSignature
} from "./cashfree.js";

export { verifyCashfreeWebhookSignature as verifyWebhookSignature };

export function addCalendarMonths(date, months) {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const maxDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, maxDay));
  return next;
}

export function makeInternalOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `DB_${stamp}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function getAppBaseUrl() {
  const configured = process.env.APP_BASE_URL || process.env.PUBLIC_APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5173";
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return "";
}

function cleanCustomerId(value) {
  return String(value || "student").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) || "student";
}

function cleanDocId(value) {
  return String(value || crypto.randomUUID()).replace(/[\/#?\[\]]/g, "_");
}

function normalizeOrderStatus(status) {
  const value = String(status || "").toUpperCase();
  if (["PAID", "SUCCESS"].includes(value)) return "paid";
  if (["FAILED", "CANCELLED", "TERMINATED"].includes(value)) return "failed";
  if (value === "EXPIRED") return "expired";
  if (value === "USER_DROPPED") return "cancelled";
  return "pending";
}

function getPaidPayment(payments) {
  if (!Array.isArray(payments)) return null;
  return payments.find((payment) => String(payment.payment_status || payment.status || "").toUpperCase() === "SUCCESS") || null;
}

function stringifyPaymentMethod(payment) {
  const group = payment?.payment_group;
  if (group) return String(group);
  const method = payment?.payment_method;
  if (!method) return "Secure Payment";
  if (typeof method === "string") return method;
  const keys = Object.keys(method).filter((key) => method[key]);
  return keys[0] || "Secure Payment";
}
function getGatewayOrderId(order) {
  return order.cashfreeOrderId || order.providerOrderId || order.internalOrderNumber;
}

function amountMatches(expected, actual) {
  return Math.abs(Number(expected) - Number(actual)) < 0.01;
}

function serializeDate(value) {
  return value?.toDate ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value || null;
}

function serializeSubscription(id, data, now = new Date()) {
  const accessEnd = data.accessEndAt?.toDate?.();
  const computedStatus = data.status === "active" && accessEnd && accessEnd <= now ? "expired" : data.status;
  return { id, ...data, status: computedStatus, accessStartAt: serializeDate(data.accessStartAt), accessEndAt: serializeDate(data.accessEndAt), createdAt: serializeDate(data.createdAt), updatedAt: serializeDate(data.updatedAt) };
}

function serializePayment(id, data) {
  return { id, ...data, createdAt: serializeDate(data.createdAt), capturedAt: serializeDate(data.capturedAt), updatedAt: serializeDate(data.updatedAt) };
}

function serializeOrder(id, data) {
  return { id, ...data, createdAt: serializeDate(data.createdAt), updatedAt: serializeDate(data.updatedAt), paidAt: serializeDate(data.paidAt), failedAt: serializeDate(data.failedAt), accessStartAt: serializeDate(data.accessStartAt), accessEndAt: serializeDate(data.accessEndAt) };
}

async function activateEntitlement(tx, db, orderRef, order, paymentId, source, paidAtDate) {
  const subscriptionId = `${order.userId}_${order.variantId}`;
  const subRef = db.collection("subscriptions").doc(subscriptionId);
  const existing = await tx.get(subRef);
  const currentEnd = existing.exists && existing.data().accessEndAt?.toDate ? existing.data().accessEndAt.toDate() : null;
  const start = currentEnd && currentEnd > paidAtDate ? currentEnd : paidAtDate;
  const end = addCalendarMonths(start, order.trustedPlanSnapshot.durationMonths);

  tx.set(subRef, {
    userId: order.userId,
    userEmail: order.userEmail,
    planId: order.planId,
    variantId: order.variantId,
    planName: order.trustedPlanSnapshot.name,
    durationLabel: order.trustedPlanSnapshot.durationLabel,
    status: "active",
    accessTags: order.trustedPlanSnapshot.accessTags || [],
    accessStartAt: start,
    accessEndAt: end,
    source,
    orderId: orderRef.id,
    paymentId,
    createdAt: existing.exists ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  tx.update(orderRef, {
    paymentStatus: "paid",
    orderStatus: "paid",
    paymentId,
    accessStartAt: start,
    accessEndAt: end,
    paidAt: paidAtDate,
    updatedAt: serverTimestamp()
  });

  return { subscriptionId, accessStartAt: start.toISOString(), accessEndAt: end.toISOString() };
}

export async function createOrderForVariant(user, variantId, billing = {}) {
  const selected = getVariant(variantId);
  if (!selected) {
    const error = new Error("Invalid or inactive plan variant.");
    error.statusCode = 400;
    throw error;
  }

  const phone = normalizePhone(billing.phone);
  if (!phone) {
    const error = new Error("Enter a valid 10-digit mobile number before payment.");
    error.statusCode = 400;
    throw error;
  }

  const { plan, variant } = selected;
  const snapshot = planSnapshot(plan, variant);
  const db = getDb();
  const now = new Date();
  const internalOrderNumber = makeInternalOrderNumber();
  const orderRef = db.collection("orders").doc(internalOrderNumber);

  let isExtension = false;
  try {
    const subscriptionId = `${user.uid}_${variant.variantId}`;
    const subscriptionSnap = await db.collection("subscriptions").doc(subscriptionId).get();
    const existingSubscription = subscriptionSnap.exists ? subscriptionSnap.data() : null;
    const existingEnd = existingSubscription?.accessEndAt?.toDate ? existingSubscription.accessEndAt.toDate() : null;
    isExtension = existingSubscription?.status === "active" && existingEnd && existingEnd > now;
  } catch (cause) {
    const error = new Error("Could not read subscription state.");
    error.statusCode = 500;
    error.safeMessage = `Firestore could not read subscriptions (${cause.code || "unknown"}). ${cause.message || "Check Firebase Admin service account permissions and Firestore database setup."}`;
    error.cause = cause;
    throw error;
  }

  const billingRecord = {
    name: String(billing.name || user.name || user.displayName || user.email || "Student").slice(0, 120),
    phone,
    address: String(billing.address || "").slice(0, 500)
  };

  try {
    await orderRef.set({
      internalOrderNumber,
      provider: "cashfree",
      userId: user.uid,
      userEmail: user.email || "",
      planId: snapshot.planId,
      variantId: snapshot.variantId,
      trustedPlanSnapshot: snapshot,
      billing: billingRecord,
      amount: snapshot.priceInRupees,
      amountInPaise: snapshot.priceInPaise,
      currency: snapshot.currency,
      paymentStatus: "pending",
      orderStatus: "created",
      isExtension,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (cause) {
    const error = new Error("Could not store pending order.");
    error.statusCode = 500;
    error.safeMessage = `Firestore could not store the pending order (${cause.code || "unknown"}). ${cause.message || "Check Firebase Admin service account permissions and Firestore database setup."}`;
    error.cause = cause;
    throw error;
  }

  const appBaseUrl = getAppBaseUrl();
  let gatewayOrder;
  try {
    gatewayOrder = await createCashfreeOrder({
      order_id: internalOrderNumber,
      order_amount: snapshot.priceInRupees,
      order_currency: snapshot.currency,
      customer_details: {
        customer_id: cleanCustomerId(user.uid),
        customer_name: billingRecord.name,
        customer_email: user.email || "student@delightbanking.com",
        customer_phone: phone
      },
      order_meta: {
        return_url: `${appBaseUrl}/payment/status?order_id=${internalOrderNumber}`,
        notify_url: `${appBaseUrl}/api/payments/webhook`
      },
      order_note: `${snapshot.name} ${snapshot.durationLabel}`
    });
  } catch (cause) {
    await orderRef.set({ orderStatus: "gateway_create_failed", paymentStatus: "failed", gatewayError: cause.message, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    const error = new Error("Could not create payment order.");
    error.statusCode = cause.statusCode || 502;
    error.safeMessage = cause.safeMessage || "Payment order creation failed. Check payment gateway credentials and mode in Vercel.";
    error.cause = cause;
    throw error;
  }

  await orderRef.set({
    providerOrderId: gatewayOrder.order_id || internalOrderNumber,
    cashfreeOrderId: gatewayOrder.order_id || internalOrderNumber,
    cashfreeOrderStatus: gatewayOrder.order_status || "ACTIVE",
    paymentSessionCreated: Boolean(gatewayOrder.payment_session_id),
    updatedAt: serverTimestamp()
  }, { merge: true });

  if (!gatewayOrder.payment_session_id) {
    const error = new Error("Payment gateway did not return a checkout session.");
    error.statusCode = 502;
    error.safeMessage = "Payment gateway did not return a checkout session. Check payment gateway credentials and mode.";
    throw error;
  }

  return {
    orderDocumentId: orderRef.id,
    orderId: orderRef.id,
    internalOrderNumber,
    providerOrderId: gatewayOrder.order_id || internalOrderNumber,
    cashfreeOrderId: gatewayOrder.order_id || internalOrderNumber,
    paymentSessionId: gatewayOrder.payment_session_id,
    mode: getCashfreeMode(),
    amount: snapshot.priceInRupees,
    currency: snapshot.currency,
    plan: snapshot,
    isExtension
  };
}

async function syncOrderWithCashfree(orderRef, source = "status_check") {
  const db = getDb();
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    const error = new Error("Order was not found.");
    error.statusCode = 404;
    throw error;
  }

  const order = orderSnap.data();
  const gatewayOrderId = getGatewayOrderId(order);
  const [gatewayOrder, gatewayPayments] = await Promise.all([
    fetchCashfreeOrder(gatewayOrderId),
    fetchCashfreePayments(gatewayOrderId)
  ]);

  const normalizedStatus = normalizeOrderStatus(gatewayOrder.order_status || gatewayOrder.payment_status);
  const gatewayAmount = gatewayOrder.order_amount ?? gatewayOrder.payment_amount;
  const gatewayCurrency = gatewayOrder.order_currency || order.currency;
  if (!amountMatches(order.amount || order.trustedPlanSnapshot.priceInRupees, gatewayAmount) || gatewayCurrency !== order.currency) {
    const error = new Error("Payment details do not match the trusted order.");
    error.statusCode = 400;
    throw error;
  }

  const paidPayment = getPaidPayment(gatewayPayments);
  const paymentId = cleanDocId(paidPayment?.cf_payment_id || paidPayment?.payment_id || gatewayOrder.cf_payment_id || gatewayOrderId);
  const paidAt = paidPayment?.payment_completion_time ? new Date(paidPayment.payment_completion_time) : new Date();
  let activation = null;

  if (normalizedStatus === "paid") {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(orderRef);
      const freshOrder = fresh.data();
      const paymentRef = db.collection("payments").doc(paymentId);
      const existingPayment = await tx.get(paymentRef);
      if (freshOrder.paymentStatus === "paid" && existingPayment.exists) {
        activation = {
          accessStartAt: serializeDate(freshOrder.accessStartAt),
          accessEndAt: serializeDate(freshOrder.accessEndAt)
        };
        return;
      }
      activation = await activateEntitlement(tx, db, orderRef, freshOrder, paymentId, source, paidAt);
      tx.set(paymentRef, {
        provider: "cashfree",
        userId: freshOrder.userId,
        userEmail: freshOrder.userEmail || "",
        orderDocumentId: orderRef.id,
        providerOrderId: gatewayOrderId,
        cashfreeOrderId: gatewayOrderId,
        cashfreePaymentId: paymentId,
        amount: Number(paidPayment?.payment_amount || gatewayAmount || freshOrder.amount || 0),
        amountInPaise: Math.round(Number(paidPayment?.payment_amount || gatewayAmount || freshOrder.amount || 0) * 100),
        currency: paidPayment?.payment_currency || gatewayCurrency,
        status: paidPayment?.payment_status || gatewayOrder.order_status || "SUCCESS",
        paymentMethod: stringifyPaymentMethod(paidPayment),
        verified: true,
        signatureVerified: source === "cashfree_webhook",
        gatewayPayload: paidPayment || null,
        createdAt: existingPayment.exists ? existingPayment.data().createdAt : serverTimestamp(),
        capturedAt: paidAt,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  } else {
    await orderRef.set({
      paymentStatus: normalizedStatus,
      orderStatus: normalizedStatus,
      cashfreeOrderStatus: gatewayOrder.order_status || null,
      gatewayPayload: gatewayOrder,
      failedAt: ["failed", "expired", "cancelled"].includes(normalizedStatus) ? serverTimestamp() : fieldValue.delete(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  const fresh = await orderRef.get();
  return { ...serializeOrder(fresh.id, fresh.data()), gatewayStatus: gatewayOrder.order_status || null, payments: Array.isArray(gatewayPayments) ? gatewayPayments.length : 0, ...activation };
}

export async function verifyAndRecordPayment(user, payload) {
  const orderId = payload.orderId || payload.order_id || payload.internalOrderNumber;
  if (!orderId) {
    const error = new Error("Order id is required for payment verification.");
    error.statusCode = 400;
    throw error;
  }
  const db = getDb();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    const error = new Error("Order was not found.");
    error.statusCode = 404;
    throw error;
  }
  if (snap.data().userId !== user.uid) {
    const error = new Error("This order belongs to another user.");
    error.statusCode = 403;
    throw error;
  }
  return syncOrderWithCashfree(orderRef, "checkout_status_check");
}

export async function getOrderStatusForUser(user, orderId) {
  if (!orderId) {
    const error = new Error("Order id is required.");
    error.statusCode = 400;
    throw error;
  }
  const db = getDb();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    const error = new Error("Order was not found.");
    error.statusCode = 404;
    throw error;
  }
  if (snap.data().userId !== user.uid) {
    const error = new Error("Not allowed to view this order.");
    error.statusCode = 403;
    throw error;
  }
  return syncOrderWithCashfree(orderRef, "status_check");
}

export async function getUserPaymentSummary(user) {
  const db = getDb();
  const [subsSnap, paymentsSnap, ordersSnap] = await Promise.all([
    db.collection("subscriptions").where("userId", "==", user.uid).get(),
    db.collection("payments").where("userId", "==", user.uid).limit(50).get(),
    db.collection("orders").where("userId", "==", user.uid).limit(50).get()
  ]);
  const now = new Date();
  return {
    subscriptions: subsSnap.docs.map((doc) => serializeSubscription(doc.id, doc.data(), now)),
    payments: paymentsSnap.docs.map((doc) => serializePayment(doc.id, doc.data())),
    orders: ordersSnap.docs.map((doc) => serializeOrder(doc.id, doc.data()))
  };
}

function getWebhookOrderId(event) {
  return event?.data?.order?.order_id || event?.data?.payment?.order_id || event?.data?.order_id || event?.order_id || null;
}

function getWebhookEventId(event, rawFallback = "") {
  return event?.event_id || event?.id || event?.data?.payment?.cf_payment_id || event?.data?.payment?.payment_id || crypto.createHash("sha256").update(`${event?.type || event?.event || "event"}:${getWebhookOrderId(event) || "none"}:${rawFallback}`).digest("hex");
}

export async function processWebhookEvent(event, rawFallback = "") {
  const db = getDb();
  const eventId = cleanDocId(getWebhookEventId(event, rawFallback));
  const eventRef = db.collection("cashfreeWebhookEvents").doc(eventId);
  const existing = await eventRef.get();
  if (existing.exists) return { processed: false, duplicate: true };

  await eventRef.set({ type: event.type || event.event || "cashfree_event", receivedAt: serverTimestamp(), processed: false });
  const orderId = getWebhookOrderId(event);
  if (!orderId) {
    await eventRef.update({ processed: true, ignored: true, updatedAt: serverTimestamp() });
    return { processed: true, ignored: true };
  }

  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    await eventRef.update({ processed: true, unmatched: true, orderId, updatedAt: serverTimestamp() });
    return { processed: true, unmatched: true };
  }

  try {
    const result = await syncOrderWithCashfree(orderRef, "cashfree_webhook");
    await eventRef.update({ processed: true, orderId, paymentStatus: result.paymentStatus, updatedAt: serverTimestamp() });
    return { processed: true, paymentStatus: result.paymentStatus };
  } catch (cause) {
    await eventRef.update({ processed: false, orderId, error: cause.message, updatedAt: serverTimestamp() });
    throw cause;
  }
}

