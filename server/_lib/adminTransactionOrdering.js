const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function epochMs(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value?.toMillis === "function") {
    const milliseconds = value.toMillis();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  if (typeof value?.toDate === "function") return epochMs(value.toDate());
  if (typeof value === "object" && Number.isFinite(value.seconds ?? value._seconds)) {
    return Number(value.seconds ?? value._seconds) * 1000 + Math.floor(Number(value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
  }
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export function formatTransactionDateIst(value) {
  const milliseconds = epochMs(value);
  if (milliseconds === null) return "Transaction date unavailable";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  }).formatToParts(new Date(milliseconds)).map((part) => [part.type, part.value]));
  return parts.day + " " + MONTHS[Number(parts.month) - 1] + " " + parts.year + ", " + parts.hour + ":" + parts.minute + " " + parts.dayPeriod.toUpperCase() + " IST";
}

function firstTimestamp(candidates) {
  for (const [value, label, source] of candidates) {
    const milliseconds = epochMs(value);
    if (milliseconds !== null) return { transactionDateMs: milliseconds, transactionDateAt: new Date(milliseconds).toISOString(), transactionDateIst: formatTransactionDateIst(milliseconds), transactionDateLabel: label, transactionDateSource: source };
  }
  return { transactionDateMs: null, transactionDateAt: null, transactionDateIst: "Transaction date unavailable", transactionDateLabel: "Transaction date unavailable", transactionDateSource: "unavailable" };
}

export function transactionTimestamp(data = {}, normalizedStatus = "pending", order = {}) {
  if (normalizedStatus === "successful") {
    return firstTimestamp([
      [data.capturedAt ?? data.paymentCompletionTime ?? data.payment_completion_time, "Payment completed", "cashfree_completion"],
      [data.webhookPaymentAt ?? data.webhookVerifiedAt ?? data.paymentVerifiedAt ?? data.paidAt, "Payment verified", "verified_webhook"],
      [data.createdAt, "Transaction created", "transaction_created"]
    ]);
  }
  const statusCandidates = normalizedStatus === "failed"
    ? [[data.failedAt, "Payment failed", "payment_failed"]]
    : normalizedStatus === "cancelled"
      ? [[data.cancelledAt ?? data.failedAt, "Payment cancelled", "payment_cancelled"]]
      : normalizedStatus === "user_dropped"
        ? [[data.userDroppedAt ?? data.droppedAt ?? data.failedAt, "User dropped", "user_dropped"]]
        : [[data.pendingAt ?? data.paymentAttemptedAt ?? data.attemptedAt, "Payment pending", "payment_pending"]];
  return firstTimestamp([
    ...statusCandidates,
    [data.createdAt, "Transaction created", "transaction_created"],
    [order.createdAt, "Order created", "order_created"]
  ]);
}

export function sortTransactions(items, direction = "transaction_desc") {
  const ascending = direction === "transaction_asc" || direction === "oldest";
  return [...items].sort((left, right) => {
    const leftTime = Number.isFinite(left.transactionDateMs) ? left.transactionDateMs : null;
    const rightTime = Number.isFinite(right.transactionDateMs) ? right.transactionDateMs : null;
    if (leftTime === null && rightTime !== null) return 1;
    if (leftTime !== null && rightTime === null) return -1;
    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return ascending ? leftTime - rightTime : rightTime - leftTime;
    return String(left.id || left.transactionId).localeCompare(String(right.id || right.transactionId));
  });
}

export function paginateTransactions(items, query = {}) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const page = Math.max(Number(query.page || 1), 1);
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { page, pageSize, total, hasMore: start + pageSize < total, items: items.slice(start, start + pageSize) };
}

export function prepareTransactions(items, query = {}, predicate = () => true) {
  return paginateTransactions(sortTransactions(items.filter(predicate), query.sort || "transaction_desc"), query);
}
