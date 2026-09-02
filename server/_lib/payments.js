import crypto from "node:crypto";
import { getDb, serverTimestamp } from "./firebaseAdmin.js";
import { getCheckoutVariant, planSnapshot } from "./planManagement.js";
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
  return `DB_${stamp}_${crypto.randomBytes(6).toString("hex").toUpperCase()}`.slice(0, 45);
}

function getAppBaseUrl() {
  const configured = String(process.env.APP_BASE_URL || process.env.PUBLIC_APP_BASE_URL || "").trim().replace(/\/+$/, "");
  const environment = getCashfreeMode();

  if (configured) {
    if (environment === "production" && configured !== "https://www.delightguidance.com") {
      const error = new Error("Production APP_BASE_URL must be https://www.delightguidance.com.");
      error.statusCode = 500;
      error.safeMessage = "APP_BASE_URL must be https://www.delightguidance.com before production payments can be created.";
      throw error;
    }
    return configured;
  }

  if (environment === "production") {
    const error = new Error("APP_BASE_URL is required for production payments.");
    error.statusCode = 500;
    error.safeMessage = "APP_BASE_URL must be configured as https://www.delightguidance.com before production payments can be created.";
    throw error;
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5173";
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return "";
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function cleanCustomerId(value) {
  return String(value || "student").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) || "student";
}

function cleanDocId(value) {
  return String(value || crypto.randomUUID()).replace(/[\/#?\[\]]/g, "_");
}

function paymentStatusValue(payment) {
  return String(payment?.payment_status || payment?.status || payment?.payment_status_code || "").toUpperCase();
}

function normalizeOrderStatus(status, payments = []) {
  const value = String(status || "").toUpperCase();
  const paymentStatuses = Array.isArray(payments) ? payments.map(paymentStatusValue) : [];
  if (["PAID", "SUCCESS"].includes(value) || paymentStatuses.includes("SUCCESS")) return "paid";
  if (value === "FAILED" || paymentStatuses.includes("FAILED")) return "failed";
  if (["USER_DROPPED", "CANCELLED", "TERMINATED", "EXPIRED"].includes(value) || paymentStatuses.includes("USER_DROPPED")) return "cancelled";
  if (["ACTIVE", "PENDING"].includes(value)) return "pending";
  return "pending";
}

function hasCashfreePaymentAttempt(payments = []) {
  return Array.isArray(payments) && payments.some((payment) => paymentStatusValue(payment) || payment?.cf_payment_id || payment?.payment_id);
}

function minutesSince(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : value ? new Date(value) : null;
  const time = date?.getTime?.();
  if (!time || Number.isNaN(time)) return 0;
  return (Date.now() - time) / 60000;
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

function getMerchantOrderId(order) {
  return order.merchantOrderId || order.internalOrderNumber || order.cashfreeOrderId;
}

function getGatewayOrderId(order) {
  return order.cashfreeOrderId || order.merchantOrderId || order.internalOrderNumber;
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
  return {
    id,
    provider: data.provider || (data.razorpayPaymentId ? "razorpay" : "cashfree"),
    transactionId: data.cashfreePaymentId || data.cfPaymentId || data.providerPaymentId || data.razorpayPaymentId || id,
    cashfreeOrderId: data.cashfreeOrderId || null,
    cashfreePaymentId: data.cashfreePaymentId || data.cfPaymentId || null,
    cfPaymentId: data.cfPaymentId || data.cashfreePaymentId || null,
    merchantOrderId: data.merchantOrderId || data.providerOrderId || data.razorpayOrderId || null,
    orderDocumentId: data.orderDocumentId || null,
    userId: data.userId || null,
    planId: data.planId || null,
    variantId: data.variantId || null,
    amountInRupees: data.amountInRupees ?? data.amount ?? (data.amountInPaise ? data.amountInPaise / 100 : null),
    amountInPaise: data.amountInPaise || null,
    currency: data.currency || "INR",
    status: data.status || "pending",
    verified: Boolean(data.verified),
    paymentMethod: typeof data.paymentMethod === "string" ? data.paymentMethod : "Secure Payment",
    refundStatus: data.refundStatus || null,
    refundId: data.refundId || null,
    refundAmount: data.refundAmount || null,
    disputeStatus: data.disputeStatus || null,
    disputeId: data.disputeId || null,
    capturedAt: serializeDate(data.capturedAt),
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  };
}

function safeOrder(id, data) {
  return {
    id,
    orderId: id,
    internalOrderNumber: data.internalOrderNumber || id,
    merchantOrderId: data.merchantOrderId || data.internalOrderNumber || id,
    cashfreeOrderId: data.cashfreeOrderId || null,
    provider: data.provider || (data.razorpayOrderId ? "razorpay" : "cashfree"),
    userEmail: data.userEmail || "",
    planId: data.planId || data.trustedPlanSnapshot?.planId || null,
    variantId: data.variantId || data.trustedPlanSnapshot?.variantId || null,
    trustedPlanSnapshot: data.trustedPlanSnapshot || null,
    amountInRupees: data.amountInRupees ?? data.amount ?? (data.amountInPaise ? data.amountInPaise / 100 : null),
    amountInPaise: data.amountInPaise || null,
    currency: data.currency || "INR",
    paymentStatus: data.paymentStatus || "pending",
    orderStatus: data.orderStatus || data.paymentStatus || "pending",
    paymentId: data.paymentId || null,
    accessStartAt: serializeDate(data.accessStartAt),
    accessEndAt: serializeDate(data.accessEndAt),
    paidAt: serializeDate(data.paidAt),
    failedAt: serializeDate(data.failedAt),
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  };
}

function normalizedResult(orderRef, orderData, activation = null) {
  const order = safeOrder(orderRef.id, orderData);
  return {
    status: order.paymentStatus,
    orderId: order.orderId,
    merchantOrderId: order.merchantOrderId,
    transactionId: order.paymentId,
    plan: order.trustedPlanSnapshot,
    subscription: activation || (order.accessEndAt ? {
      planName: order.trustedPlanSnapshot?.name || "",
      accessStartAt: order.accessStartAt,
      accessEndAt: order.accessEndAt
    } : null),
    order
  };
}

async function activateEntitlement(tx, db, orderRef, order, paymentId, source, paidAtDate) {
  const subscriptionId = `${order.userId}_${order.variantId}`;
  const subRef = db.collection("subscriptions").doc(subscriptionId);
  const existing = await tx.get(subRef);
  const currentEnd = existing.exists && existing.data().accessEndAt?.toDate ? existing.data().accessEndAt.toDate() : null;
  const start = currentEnd && currentEnd > paidAtDate ? currentEnd : paidAtDate;
  const end = order.trustedPlanSnapshot.validityMode === "fixed_end_date" && order.trustedPlanSnapshot.accessEndDate ? new Date(order.trustedPlanSnapshot.accessEndDate) : addCalendarMonths(start, order.trustedPlanSnapshot.durationMonths);

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

  return { planName: order.trustedPlanSnapshot.name, accessStartAt: start.toISOString(), accessEndAt: end.toISOString() };
}

export async function createOrderForVariant(user, variantId, billing = {}) {
  const selected = await getCheckoutVariant(variantId);
  if (!selected) {
    const error = new Error("Invalid or inactive plan variant.");
    error.statusCode = 400;
    throw error;
  }

  const name = normalizeName(billing.name || user.name || user.displayName || user.email?.split("@")[0]);
  const phone = normalizePhone(billing.phone);
  if (name.length < 2) {
    const error = new Error("Enter the student name before payment.");
    error.statusCode = 400;
    throw error;
  }
  if (!phone) {
    const error = new Error("Enter a valid 10-digit mobile number before payment.");
    error.statusCode = 400;
    throw error;
  }

  const { plan, variant } = selected;
  const snapshot = planSnapshot(plan, variant);
  const db = getDb();
  const now = new Date();
  const merchantOrderId = makeInternalOrderNumber();
  const orderRef = db.collection("orders").doc(merchantOrderId);

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

  const appBaseUrl = getAppBaseUrl();
  let gatewayOrder;
  try {
    gatewayOrder = await createCashfreeOrder({
      order_id: merchantOrderId,
      order_amount: snapshot.priceInRupees,
      order_currency: "INR",
      customer_details: {
        customer_id: cleanCustomerId(user.uid),
        customer_name: name,
        customer_email: user.email || "student@delightguidance.com",
        customer_phone: phone
      },
      order_meta: {
        return_url: `${appBaseUrl}/payment/status?order_id=${merchantOrderId}`,
        notify_url: `${appBaseUrl}/api/payments/webhook`
      },
      order_tags: {
        firebase_uid: cleanCustomerId(user.uid),
        plan_id: snapshot.planId,
        variant_id: snapshot.variantId
      },
      order_note: `${snapshot.name} ${snapshot.durationLabel}`
    });
  } catch (cause) {
    const error = new Error("Could not create payment order.");
    error.statusCode = cause.statusCode || 502;
    error.safeMessage = cause.safeMessage || "Payment order creation failed. Check payment gateway credentials and mode in Vercel.";
    error.cause = cause;
    throw error;
  }

  try {
    await orderRef.set({
      internalOrderNumber: merchantOrderId,
      merchantOrderId,
      cashfreeOrderId: gatewayOrder.order_id || merchantOrderId,
      provider: "cashfree",
      userId: user.uid,
      userEmail: user.email || "",
      planId: snapshot.planId,
      variantId: snapshot.variantId,
      trustedPlanSnapshot: snapshot,
      billing: {
        name,
        phone,
        address: String(billing.address || "").slice(0, 500)
      },
      amountInRupees: snapshot.priceInRupees,
      currency: "INR",
      paymentStatus: "pending",
      orderStatus: "created",
      cashfreeOrderStatus: gatewayOrder.order_status || "ACTIVE",
      paymentSessionCreated: Boolean(gatewayOrder.payment_session_id),
      isExtension,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (cause) {
    console.error("Cashfree order created but Firestore order storage failed", { merchantOrderId, cashfreeOrderId: gatewayOrder.order_id || merchantOrderId, code: cause.code || "unknown" });
    const error = new Error("Could not store pending order.");
    error.statusCode = 500;
    error.safeMessage = `Firestore could not store the pending order (${cause.code || "unknown"}). ${cause.message || "Check Firebase Admin service account permissions and Firestore database setup."}`;
    error.cause = cause;
    throw error;
  }

  if (!gatewayOrder.payment_session_id) {
    const error = new Error("Payment gateway did not return a checkout session.");
    error.statusCode = 502;
    error.safeMessage = "Payment gateway did not return a checkout session. Check payment gateway credentials and mode.";
    throw error;
  }

  return {
    orderDocumentId: orderRef.id,
    merchantOrderId,
    cashfreeOrderId: gatewayOrder.order_id || merchantOrderId,
    paymentSessionId: gatewayOrder.payment_session_id,
    amountInRupees: snapshot.priceInRupees,
    currency: "INR",
    plan: snapshot,
    environment: getCashfreeMode()
  };
}

export async function syncOrderWithCashfree(orderRef, source = "status_check") {
  const db = getDb();
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    const error = new Error("Order was not found.");
    error.statusCode = 404;
    throw error;
  }

  const order = orderSnap.data();
  if (order.paymentStatus === "paid" && order.accessEndAt) {
    return normalizedResult(orderRef, order);
  }

  const gatewayOrderId = getGatewayOrderId(order);
  const [gatewayOrder, gatewayPayments] = await Promise.all([
    fetchCashfreeOrder(gatewayOrderId),
    fetchCashfreePayments(gatewayOrderId)
  ]);

  let normalizedStatus = normalizeOrderStatus(gatewayOrder.order_status || gatewayOrder.payment_status, gatewayPayments);
  const paymentAttempted = hasCashfreePaymentAttempt(gatewayPayments);
  if (normalizedStatus === "pending" && ["failed", "cancelled"].includes(order.paymentStatus)) normalizedStatus = order.paymentStatus;
  if (normalizedStatus === "pending" && !paymentAttempted && minutesSince(order.createdAt) >= 2) normalizedStatus = "cancelled";
  const gatewayAmount = gatewayOrder.order_amount ?? gatewayOrder.payment_amount;
  const gatewayCurrency = gatewayOrder.order_currency || order.currency;
  const expectedAmount = order.amountInRupees ?? order.amount ?? order.trustedPlanSnapshot?.priceInRupees;
  if (!amountMatches(expectedAmount, gatewayAmount) || gatewayCurrency !== "INR" || order.currency !== "INR") {
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
          planName: freshOrder.trustedPlanSnapshot?.name || "",
          accessStartAt: serializeDate(freshOrder.accessStartAt),
          accessEndAt: serializeDate(freshOrder.accessEndAt)
        };
        return;
      }
      activation = await activateEntitlement(tx, db, orderRef, freshOrder, paymentId, source, paidAt);
      const amountInRupees = Number(paidPayment?.payment_amount || gatewayAmount || freshOrder.amountInRupees || 0);
      tx.set(paymentRef, {
        provider: "cashfree",
        cashfreeOrderId: gatewayOrderId,
        cashfreePaymentId: paymentId,
        cfPaymentId: paidPayment?.cf_payment_id || paymentId,
        merchantOrderId: getMerchantOrderId(freshOrder),
        orderDocumentId: orderRef.id,
        userId: freshOrder.userId,
        userEmail: freshOrder.userEmail || "",
        planId: freshOrder.planId,
        variantId: freshOrder.variantId,
        amountInRupees,
        currency: paidPayment?.payment_currency || gatewayCurrency,
        status: paidPayment?.payment_status || gatewayOrder.order_status || "SUCCESS",
        verified: true,
        paymentMethod: stringifyPaymentMethod(paidPayment),
        capturedAt: paidAt,
        createdAt: existingPayment.exists ? existingPayment.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  } else {
    const nextOrder = {
      paymentStatus: normalizedStatus,
      orderStatus: normalizedStatus === "cancelled" && !paymentAttempted ? "no_payment_attempt" : normalizedStatus,
      cashfreeOrderStatus: gatewayOrder.order_status || null,
      paymentAttempted,
      updatedAt: serverTimestamp()
    };
    if (["failed", "expired", "cancelled"].includes(normalizedStatus)) nextOrder.failedAt = serverTimestamp();
    await orderRef.set(nextOrder, { merge: true });
  }

  const fresh = await orderRef.get();
  return normalizedResult(orderRef, fresh.data(), activation);
}

export async function verifyAndRecordPayment(user, payload) {
  const orderId = payload.orderId || payload.order_id || payload.merchantOrderId;
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
  const order = snap.data();
  if (order.userId !== user.uid) {
    const error = new Error("This order belongs to another user.");
    error.statusCode = 403;
    throw error;
  }
  if (getMerchantOrderId(order) !== orderId && order.cashfreeOrderId !== orderId) {
    const error = new Error("Order details do not match the trusted record.");
    error.statusCode = 400;
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
  const order = snap.data();
  if (order.userId !== user.uid) {
    const error = new Error("Not allowed to view this order.");
    error.statusCode = 403;
    throw error;
  }
  if (order.paymentStatus === "paid") return normalizedResult(orderRef, order);
  return syncOrderWithCashfree(orderRef, "status_check");
}

export async function getUserPaymentSummary(user) {
  const db = getDb();
  const studentSnap = await db.collection("students").doc(user.uid).get();
  const accountStatus = studentSnap.exists ? studentSnap.data().accountStatus || studentSnap.data().status : "active";
  if (["suspended", "blocked"].includes(accountStatus)) {
    const error = new Error("This account cannot access protected subscription content.");
    error.statusCode = 403;
    throw error;
  }
  const [subsSnap, paymentsSnap, ordersSnap] = await Promise.all([
    db.collection("subscriptions").where("userId", "==", user.uid).get(),
    db.collection("payments").where("userId", "==", user.uid).limit(50).get(),
    db.collection("orders").where("userId", "==", user.uid).limit(50).get()
  ]);
  const now = new Date();
  return {
    subscriptions: subsSnap.docs.map((doc) => serializeSubscription(doc.id, doc.data(), now)),
    payments: paymentsSnap.docs.map((doc) => serializePayment(doc.id, doc.data())),
    orders: ordersSnap.docs.map((doc) => safeOrder(doc.id, doc.data()))
  };
}

function getWebhookOrderId(event) {
  return event?.data?.order?.order_id || event?.data?.payment?.order_id || event?.data?.refund?.order_id || event?.data?.dispute?.order_id || event?.data?.order_id || event?.order_id || null;
}

function getWebhookPaymentId(event) {
  return event?.data?.payment?.cf_payment_id || event?.data?.payment?.payment_id || event?.data?.refund?.cf_payment_id || event?.data?.dispute?.cf_payment_id || null;
}

function getWebhookEventId(event, rawFallback = "") {
  return event?.event_id || event?.id || getWebhookPaymentId(event) || crypto.createHash("sha256").update(`${event?.type || event?.event || "event"}:${getWebhookOrderId(event) || "none"}:${rawFallback}`).digest("hex");
}

async function recordRefundOrDispute(db, event, orderId) {
  const type = String(event.type || event.event || "").toUpperCase();
  const paymentId = cleanDocId(getWebhookPaymentId(event) || event?.data?.refund?.cf_payment_id || event?.data?.dispute?.cf_payment_id || orderId);
  const payload = { updatedAt: serverTimestamp() };
  if (type.includes("REFUND")) {
    payload.refundStatus = event?.data?.refund?.refund_status || type;
    payload.refundId = event?.data?.refund?.cf_refund_id || event?.data?.refund?.refund_id || null;
    payload.refundAmount = event?.data?.refund?.refund_amount || null;
  }
  if (type.includes("DISPUTE")) {
    payload.disputeStatus = event?.data?.dispute?.dispute_status || type;
    payload.disputeId = event?.data?.dispute?.cf_dispute_id || event?.data?.dispute?.dispute_id || null;
  }
  await db.collection("payments").doc(paymentId).set(payload, { merge: true });
}

function isSupportedWebhookType(type) {
  const value = String(type || "").toUpperCase();
  return value.includes("PAYMENT_SUCCESS") || value.includes("PAYMENT_FAILED") || value.includes("PAYMENT_USER_DROPPED") || value.includes("REFUND") || value.includes("DISPUTE");
}

export async function processWebhookEvent(event, rawFallback = "") {
  const type = event.type || event.event || "cashfree_event";
  const orderId = getWebhookOrderId(event);

  if (!orderId || !isSupportedWebhookType(type)) {
    return { received: true, processed: false, reason: "test_or_unsupported_event" };
  }

  const db = getDb();
  const eventId = cleanDocId(getWebhookEventId(event, rawFallback));
  const eventRef = db.collection("webhookEvents").doc(eventId);
  const existing = await eventRef.get();
  if (existing.exists) return { received: true, processed: false, duplicate: true };

  await eventRef.set({ provider: "cashfree", type, orderId, receivedAt: serverTimestamp(), processed: false });

  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    await eventRef.update({ processed: false, ignored: true, reason: "unknown_order", updatedAt: serverTimestamp() });
    console.info("Cashfree webhook ignored", { eventType: type, orderFound: false, reconciliationRequired: true });
    return { received: true, processed: false, reason: "unknown_order" };
  }

  const upperType = String(type).toUpperCase();
  if (upperType.includes("REFUND") || upperType.includes("DISPUTE")) {
    await recordRefundOrDispute(db, event, orderId);
    await eventRef.update({ processed: true, updatedAt: serverTimestamp() });
    return { received: true, processed: true, recorded: true };
  }

  if (upperType.includes("PAYMENT_USER_DROPPED")) {
    if (snap.data().paymentStatus === "paid") {
      await eventRef.update({ processed: true, paymentStatus: "paid", ignored: true, reason: "already_paid", updatedAt: serverTimestamp() });
      return { received: true, processed: true, paymentStatus: "paid" };
    }
    await orderRef.set({ paymentStatus: "cancelled", orderStatus: "user_dropped", cashfreeOrderStatus: "USER_DROPPED", paymentAttempted: false, failedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    await eventRef.update({ processed: true, paymentStatus: "cancelled", updatedAt: serverTimestamp() });
    return { received: true, processed: true, paymentStatus: "cancelled" };
  }

  try {
    const result = await syncOrderWithCashfree(orderRef, "cashfree_webhook");
    await eventRef.update({ processed: true, paymentStatus: result.status, updatedAt: serverTimestamp() });
    return { received: true, processed: true, paymentStatus: result.status };
  } catch (cause) {
    await eventRef.update({ processed: false, error: cause.message, updatedAt: serverTimestamp() }).catch(() => {});
    throw cause;
  }
}


