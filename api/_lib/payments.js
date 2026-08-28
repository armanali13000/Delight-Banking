import crypto from "node:crypto";
import Razorpay from "razorpay";
import { fieldValue, getDb, serverTimestamp } from "./firebaseAdmin.js";
import { getVariant, planSnapshot } from "./plans.js";

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error("Razorpay server keys are not configured.");
    error.statusCode = 500;
    error.safeMessage = "Razorpay server keys are not configured. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel.";
    throw error;
  }
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

export function addCalendarMonths(date, months) {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const maxDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, maxDay));
  return next;
}

export function verifyPaymentSignature(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(body).digest("hex");
  const actual = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

export function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "").update(rawBody).digest("hex");
  const actual = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

export function makeInternalOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `DB-${stamp}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createOrderForVariant(user, variantId, billing = {}) {
  const selected = getVariant(variantId);
  if (!selected) {
    const error = new Error("Invalid or inactive plan variant.");
    error.statusCode = 400;
    throw error;
  }

  const { plan, variant } = selected;
  const snapshot = planSnapshot(plan, variant);
  const db = getDb();
  const now = new Date();

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
    error.safeMessage = "Firestore could not read subscriptions. Check Firebase Admin service account permissions and Firestore database setup.";
    error.cause = cause;
    throw error;
  }

  const receipt = makeInternalOrderNumber();
  let razorpayOrder;
  try {
    razorpayOrder = await getRazorpay().orders.create({
      amount: snapshot.priceInPaise,
      currency: snapshot.currency,
      receipt,
      notes: {
        internalOrderNumber: receipt,
        userId: user.uid,
        userEmail: user.email || "",
        planId: snapshot.planId,
        variantId: snapshot.variantId
      }
    });
  } catch (cause) {
    const error = new Error("Could not create Razorpay order.");
    error.statusCode = 500;
    error.safeMessage = "Razorpay order creation failed. Check RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and that both keys are from the same Razorpay mode.";
    error.cause = cause;
    throw error;
  }

  let doc;
  try {
    doc = await db.collection("orders").add({
      internalOrderNumber: receipt,
      userId: user.uid,
      userEmail: user.email || "",
      planId: snapshot.planId,
      variantId: snapshot.variantId,
      trustedPlanSnapshot: snapshot,
      billing: {
        name: String(billing.name || user.name || user.email || "").slice(0, 120),
        phone: String(billing.phone || "").slice(0, 30),
        address: String(billing.address || "").slice(0, 500)
      },
      amountInPaise: snapshot.priceInPaise,
      currency: snapshot.currency,
      razorpayOrderId: razorpayOrder.id,
      paymentStatus: "pending",
      orderStatus: "created",
      isExtension,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (cause) {
    const error = new Error("Could not store pending order.");
    error.statusCode = 500;
    error.safeMessage = "Firestore could not store the pending order. Check Firebase Admin service account permissions and Firestore database setup.";
    error.cause = cause;
    throw error;
  }

  return {
    orderDocumentId: doc.id,
    internalOrderNumber: receipt,
    razorpayOrderId: razorpayOrder.id,
    amountInPaise: snapshot.priceInPaise,
    currency: snapshot.currency,
    plan: snapshot,
    keyId: process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    isExtension
  };
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

export async function verifyAndRecordPayment(user, payload) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = payload;
  if (!orderId || !paymentId || !signature) {
    const error = new Error("Payment verification details are incomplete.");
    error.statusCode = 400;
    throw error;
  }
  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    const error = new Error("Payment signature verification failed.");
    error.statusCode = 400;
    throw error;
  }

  const db = getDb();
  const orders = await db.collection("orders").where("razorpayOrderId", "==", orderId).limit(1).get();
  if (orders.empty) {
    const error = new Error("Order was not found.");
    error.statusCode = 404;
    throw error;
  }
  const orderRef = orders.docs[0].ref;
  const order = orders.docs[0].data();
  if (order.userId !== user.uid) {
    const error = new Error("This order belongs to another user.");
    error.statusCode = 403;
    throw error;
  }

  const rzPayment = await getRazorpay().payments.fetch(paymentId);
  if (rzPayment.order_id !== orderId || rzPayment.amount !== order.amountInPaise || rzPayment.currency !== order.currency) {
    const error = new Error("Payment details do not match the trusted order.");
    error.statusCode = 400;
    throw error;
  }

  const paidAt = rzPayment.created_at ? new Date(rzPayment.created_at * 1000) : new Date();
  let activation = null;
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(orderRef);
    const freshOrder = fresh.data();
    const paymentRef = db.collection("payments").doc(paymentId);
    const existingPayment = await tx.get(paymentRef);
    if (freshOrder.paymentStatus === "paid" && existingPayment.exists) {
      activation = {
        accessStartAt: freshOrder.accessStartAt?.toDate?.().toISOString?.() || null,
        accessEndAt: freshOrder.accessEndAt?.toDate?.().toISOString?.() || null
      };
      return;
    }
    activation = await activateEntitlement(tx, db, orderRef, freshOrder, paymentId, "checkout_verification", paidAt);
    tx.set(paymentRef, {
      userId: user.uid,
      userEmail: user.email || order.userEmail || "",
      orderDocumentId: orderRef.id,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      amountInPaise: rzPayment.amount,
      currency: rzPayment.currency,
      status: rzPayment.status,
      paymentMethod: rzPayment.method || "",
      verified: true,
      signatureVerified: true,
      createdAt: serverTimestamp(),
      capturedAt: paidAt,
      refundedAmount: rzPayment.amount_refunded || 0,
      refundStatus: rzPayment.refund_status || "none"
    }, { merge: true });
  });

  return { orderId: orderRef.id, internalOrderNumber: order.internalOrderNumber, paymentId, plan: order.trustedPlanSnapshot, ...activation };
}

export async function getOrderStatusForUser(user, orderId) {
  const db = getDb();
  const snap = await db.collection("orders").doc(orderId).get();
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
  return serializeOrder(snap.id, order);
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

export async function processWebhookEvent(event) {
  const db = getDb();
  const eventId = event.id;
  if (!eventId) return { processed: false };
  const eventRef = db.collection("razorpayWebhookEvents").doc(eventId);
  const existing = await eventRef.get();
  if (existing.exists) return { processed: false, duplicate: true };

  await eventRef.set({ type: event.event, receivedAt: serverTimestamp(), processed: false });
  const payment = event.payload?.payment?.entity;
  const orderEntity = event.payload?.order?.entity;
  const razorpayOrderId = payment?.order_id || orderEntity?.id;
  if (!razorpayOrderId) {
    await eventRef.update({ processed: true, ignored: true, updatedAt: serverTimestamp() });
    return { processed: true, ignored: true };
  }

  const orders = await db.collection("orders").where("razorpayOrderId", "==", razorpayOrderId).limit(1).get();
  if (orders.empty) {
    await eventRef.update({ processed: true, unmatched: true, updatedAt: serverTimestamp() });
    return { processed: true, unmatched: true };
  }
  const orderRef = orders.docs[0].ref;
  const order = orders.docs[0].data();

  if (["payment.captured", "order.paid"].includes(event.event) && payment?.id) {
    const paidAt = payment.created_at ? new Date(payment.created_at * 1000) : new Date();
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(orderRef);
      const freshOrder = fresh.data();
      const paymentRef = db.collection("payments").doc(payment.id);
      if (freshOrder.paymentStatus !== "paid" && payment.amount === order.amountInPaise && payment.currency === order.currency) {
        await activateEntitlement(tx, db, orderRef, freshOrder, payment.id, "razorpay_webhook", paidAt);
      }
      tx.set(paymentRef, {
        userId: order.userId,
        userEmail: order.userEmail || "",
        orderDocumentId: orderRef.id,
        razorpayOrderId,
        razorpayPaymentId: payment.id,
        amountInPaise: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.method || "",
        verified: true,
        signatureVerified: false,
        createdAt: serverTimestamp(),
        capturedAt: paidAt,
        refundedAmount: payment.amount_refunded || 0,
        refundStatus: payment.refund_status || "none"
      }, { merge: true });
    });
  }

  if (event.event === "payment.failed") {
    await orderRef.update({ paymentStatus: "failed", orderStatus: "failed", failedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  if (["refund.created", "refund.processed"].includes(event.event) && payment?.id) {
    await db.collection("payments").doc(payment.id).set({ refundStatus: event.event, updatedAt: serverTimestamp() }, { merge: true });
  }

  await eventRef.update({ processed: true, updatedAt: serverTimestamp() });
  return { processed: true };
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
  return { id, ...data, createdAt: serializeDate(data.createdAt), capturedAt: serializeDate(data.capturedAt) };
}

function serializeOrder(id, data) {
  return { id, ...data, createdAt: serializeDate(data.createdAt), updatedAt: serializeDate(data.updatedAt), paidAt: serializeDate(data.paidAt), failedAt: serializeDate(data.failedAt), accessStartAt: serializeDate(data.accessStartAt), accessEndAt: serializeDate(data.accessEndAt) };
}







