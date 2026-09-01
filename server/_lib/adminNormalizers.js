import { getVariant, planSnapshot } from "./plans.js";

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function iso(value) {
  return toDate(value)?.toISOString() || null;
}

export function daysRemaining(value) {
  const end = toDate(value);
  if (!end) return null;
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function friendlyPlanName(value) {
  if (!value) return "";
  return value === "PICK UP" ? "PICK UP DAILY TARGETS" : String(value);
}

function exactPlanFromLegacy(data = {}) {
  const variantId = firstValue(data.variantId, data.variant_id, data.durationId, data.duration_id, data.planSnapshot?.variantId, data.trustedPlanSnapshot?.variantId);
  const selected = variantId ? getVariant(variantId) : null;
  if (selected) return planSnapshot(selected.plan, selected.variant);
  const planId = firstValue(data.planId, data.plan_id, data.planSnapshot?.planId, data.trustedPlanSnapshot?.planId);
  if (planId) {
    const byPlan = getVariant(variantId);
    if (byPlan) return planSnapshot(byPlan.plan, byPlan.variant);
  }
  return data.trustedPlanSnapshot || data.planSnapshot || null;
}

export function normalizePaymentStatus(value) {
  const text = String(value || "").toLowerCase();
  if (["success", "successful", "paid", "captured"].includes(text)) return "successful";
  if (text.includes("partial") && text.includes("refund")) return "partially_refunded";
  if (text.includes("refund")) return "refunded";
  if (text.includes("drop")) return "user_dropped";
  if (text.includes("cancel")) return "cancelled";
  if (text.includes("fail")) return "failed";
  return "pending";
}

export function normalizeAccessSource(value) {
  const source = String(value || "cashfree_payment").toLowerCase();
  if (source === "purchase" || source === "cashfree_webhook" || source === "checkout_status_check") return "cashfree_payment";
  if (source === "manual" || source === "admin") return "admin_granted";
  return source;
}

export function normalizePlanVariant(data = {}) {
  const snapshot = exactPlanFromLegacy(data);
  const variantId = firstValue(data.variantId, data.variant_id, data.durationId, data.duration_id, snapshot?.variantId);
  const planId = firstValue(data.planId, data.plan_id, snapshot?.planId);
  const selected = variantId ? getVariant(variantId) : null;
  const trusted = selected ? planSnapshot(selected.plan, selected.variant) : snapshot;
  const planName = friendlyPlanName(firstValue(trusted?.name, data.planName, data.plan_name, data.plan, planId));
  const durationLabel = firstValue(trusted?.durationLabel, data.durationLabel, data.duration, data.duration_name);
  const warnings = [];
  if (!planId) warnings.push("missing_plan_id");
  if (!variantId) warnings.push("missing_variant_id");
  if (!trusted?.name) warnings.push("legacy_plan_review_required");
  return {
    planId: planId || "",
    variantId: variantId || "",
    planName: planName || "Legacy record - review required",
    durationLabel: durationLabel || "Review required",
    expectedPriceInRupees: numberOrNull(trusted?.priceInRupees),
    durationMonths: numberOrNull(trusted?.durationMonths),
    accessTags: trusted?.accessTags || data.accessTags || [],
    planReviewRequired: warnings.length > 0,
    warnings
  };
}

export function normalizeUser(authUser, student = {}, subscriptions = []) {
  const activeSubs = subscriptions.filter((item) => item.userId === authUser.uid && item.status === "active");
  const current = [...activeSubs].sort((a, b) => String(b.accessEndAt || "").localeCompare(String(a.accessEndAt || "")))[0] || null;
  return {
    uid: authUser.uid,
    id: authUser.uid,
    displayName: student.name || student.displayName || authUser.displayName || authUser.email || "Student",
    email: authUser.email || student.email || "",
    phone: student.phone || authUser.phoneNumber || "",
    photoURL: student.photo || student.photoURL || authUser.photoURL || "",
    provider: student.provider || authUser.providerData?.[0]?.providerId || "password",
    emailVerified: Boolean(authUser.emailVerified || student.emailVerified),
    accountStatus: student.accountStatus || student.status || (authUser.disabled ? "blocked" : "active"),
    disabled: Boolean(authUser.disabled),
    createdAt: authUser.metadata.creationTime || student.createdAt || null,
    lastSignInAt: authUser.metadata.lastSignInTime || student.lastSeenAt || null,
    lastWebsiteActivityAt: student.lastSeenAt || null,
    profileStatus: Object.keys(student || {}).length ? "complete" : "incomplete",
    activeSubscriptionCount: activeSubs.length,
    currentPlan: current?.planName || "No active plan",
    currentVariantId: current?.variantId || "",
    subscriptionExpiry: current?.accessEndAt || null,
    targetExams: student.activeExams || (student.targetExam ? [student.targetExam] : []),
    preferredLanguage: student.preferredLanguage || "",
    preparationLevel: student.preparationLevel || "",
    city: student.city || "",
    state: student.state || "",
    address: student.address || ""
  };
}

export function normalizeOrder(id, data = {}) {
  const plan = normalizePlanVariant(data);
  return {
    id,
    orderId: id,
    internalOrderId: firstValue(data.internalOrderNumber, data.merchantOrderId, id),
    cashfreeOrderId: firstValue(data.cashfreeOrderId, data.cfOrderId, data.providerOrderId),
    userId: firstValue(data.userId, data.uid) || "",
    userEmail: firstValue(data.userEmail, data.email) || "",
    studentName: firstValue(data.billing?.name, data.userName, data.studentName, data.userEmail) || "Student",
    ...plan,
    expectedAmount: numberOrNull(firstValue(data.amountInRupees, data.amount, data.total, data.orderAmount)) ?? 0,
    currency: firstValue(data.currency, data.orderCurrency) || "INR",
    orderStatus: data.orderStatus || "created",
    paymentStatus: data.paymentStatus || "pending",
    paymentId: firstValue(data.paymentId, data.transactionId),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    paidAt: iso(data.paidAt),
    lastReconciledAt: iso(data.lastReconciledAt)
  };
}

function isVerifiedSuccessfulPayment(payment) {
  return Boolean(payment?.verified) && normalizePaymentStatus(payment?.status) === "successful";
}

export function resolveSubscriptionAmount(data = {}, order = null, payment = null) {
  const source = normalizeAccessSource(firstValue(data.source, data.accessSource));
  if (source === "complimentary") return { amountPaid: null, amountPaidLabel: "Complimentary", amountEvidence: "complimentary" };
  if (source === "admin_granted" || source === "migration") return { amountPaid: null, amountPaidLabel: source === "migration" ? "Migrated access" : "Admin granted", amountEvidence: source };
  const directVerified = numberOrNull(firstValue(data.verifiedAmount, data.amountPaid));
  if (directVerified !== null && directVerified > 0) return { amountPaid: directVerified, amountPaidLabel: null, amountEvidence: "subscription_verified_amount" };
  if (payment && isVerifiedSuccessfulPayment(payment)) {
    const amount = numberOrNull(firstValue(payment.amountInRupees, payment.amount, payment.paymentAmount));
    if (amount !== null && amount > 0) return { amountPaid: amount, amountPaidLabel: null, amountEvidence: "verified_transaction" };
  }
  if (order && normalizePaymentStatus(order.paymentStatus) === "successful") {
    const amount = numberOrNull(firstValue(order.amountInRupees, order.amount, order.total, order.orderAmount));
    if (amount !== null && amount > 0) return { amountPaid: amount, amountPaidLabel: null, amountEvidence: "paid_order" };
  }
  return { amountPaid: null, amountPaidLabel: "Payment record unavailable", amountEvidence: "missing_verified_payment" };
}

export function normalizeSubscription(id, data = {}, context = {}) {
  const plan = normalizePlanVariant(data);
  const sourceValue = firstValue(data.source, data.accessSource);
  const accessEndAt = iso(firstValue(data.accessEndAt, data.accessEnd, data.endDate, data.end_date));
  const accessStartAt = iso(firstValue(data.accessStartAt, data.accessStart, data.startDate, data.start_date));
  const status = data.status === "active" && accessEndAt && new Date(accessEndAt).getTime() <= Date.now() ? "expired" : (data.status || "pending");
  const orderId = firstValue(data.orderId, data.order_id, data.orderDocumentId, data.merchantOrderId);
  const paymentId = firstValue(data.paymentId, data.transactionId, data.transaction_id, data.cashfreePaymentId);
  const amount = resolveSubscriptionAmount(data, context.order, context.payment);
  return {
    id,
    subscriptionId: id,
    userId: firstValue(data.userId, data.uid) || "",
    uid: firstValue(data.userId, data.uid) || "",
    userEmail: firstValue(data.userEmail, data.email) || "",
    studentName: firstValue(data.studentName, data.userName, data.name, data.userEmail, data.email) || "Student",
    ...plan,
    ...amount,
    currency: firstValue(data.currency, context.payment?.currency, context.order?.currency) || "INR",
    source: normalizeAccessSource(sourceValue),
    accessSourceLabel: friendlyAccessSource(sourceValue),
    accessStartAt,
    accessEndAt,
    daysRemaining: daysRemaining(accessEndAt),
    status,
    autoRenew: Boolean(data.autoRenew),
    orderId: orderId || null,
    transactionId: paymentId || null,
    paymentId: paymentId || null,
    createdBy: data.createdBy || data.grantedBy || null,
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    reason: data.reason || data.grantReason || data.cancellationReason || data.revocationReason || "",
    consistencyWarnings: [...plan.warnings, !accessStartAt && "missing_start_date", !accessEndAt && "missing_end_date", sourceNeedsPayment(sourceValue) && !paymentId && !orderId && "missing_payment_linkage"].filter(Boolean)
  };
}

function sourceNeedsPayment(source) {
  return normalizeAccessSource(source) === "cashfree_payment";
}

export function friendlyAccessSource(value) {
  const source = normalizeAccessSource(value);
  if (source === "cashfree_payment") return "Cashfree payment";
  if (source === "admin_granted") return "Admin granted";
  if (source === "complimentary") return "Complimentary";
  if (source === "migration") return "Migration";
  return source.replace(/_/g, " ");
}

export function normalizeTransaction(id, data = {}, context = {}) {
  const plan = normalizePlanVariant(data);
  const normalizedStatus = normalizePaymentStatus(data.status || data.paymentStatus);
  const verified = Boolean(data.verified);
  const webhookVerified = Boolean(data.webhookVerified);
  const linkedSubscription = context.subscription || null;
  return {
    id,
    transactionId: id,
    internalTransactionId: id,
    cashfreePaymentId: firstValue(data.cashfreePaymentId, data.cfPaymentId, data.providerPaymentId),
    cashfreeOrderId: firstValue(data.cashfreeOrderId, data.cfOrderId),
    internalOrderId: firstValue(data.orderDocumentId, data.merchantOrderId),
    orderId: firstValue(data.orderDocumentId, data.merchantOrderId),
    orderDocumentId: data.orderDocumentId || null,
    userId: firstValue(data.userId, data.uid) || "",
    userEmail: firstValue(data.userEmail, data.email) || "",
    ...plan,
    amount: numberOrNull(firstValue(data.amountInRupees, data.amount, data.paymentAmount, data.amountPaid)) ?? 0,
    currency: firstValue(data.currency, data.paymentCurrency) || "INR",
    paymentMethod: data.paymentMethod || "Secure Payment",
    status: data.status || "pending",
    normalizedStatus,
    cashfreeStatus: data.cashfreeStatus || data.status || "",
    verified,
    webhookVerified,
    webhookState: webhookVerified ? "verified" : verified ? "server_verified" : "pending",
    signatureVerified: Boolean(data.signatureVerified || data.webhookVerified),
    subscriptionActivated: Boolean(data.subscriptionActivated || linkedSubscription?.status === "active"),
    subscriptionId: linkedSubscription?.id || data.subscriptionId || null,
    capturedAt: iso(data.capturedAt),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    lastReconciledAt: iso(data.lastReconciledAt),
    refundStatus: data.refundStatus || null,
    consistencyWarnings: [...plan.warnings, normalizedStatus === "successful" && !verified && "successful_but_not_server_verified", normalizedStatus === "successful" && !linkedSubscription && "successful_payment_without_subscription"].filter(Boolean)
  };
}

