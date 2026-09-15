import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTransaction } from "../server/_lib/adminNormalizers.js";
import { formatTransactionDateIst, paginateTransactions, prepareTransactions, sortTransactions, transactionTimestamp } from "../server/_lib/adminTransactionOrdering.js";

const latest = Date.parse("2026-09-15T06:18:00.000Z");
const earlierToday = Date.parse("2026-09-15T04:00:00.000Z");
const yesterday = Date.parse("2026-09-14T10:00:00.000Z");

test("successful payment prioritizes Cashfree completion over other timestamps", () => {
  const result = transactionTimestamp({ capturedAt: latest, webhookVerifiedAt: earlierToday, createdAt: yesterday }, "successful");
  assert.equal(result.transactionDateMs, latest);
  assert.equal(result.transactionDateLabel, "Payment completed");
  assert.equal(result.transactionDateSource, "cashfree_completion");
});

test("successful payment falls back to verified webhook timestamp then immutable creation", () => {
  const webhook = transactionTimestamp({ webhookPaymentAt: earlierToday, createdAt: yesterday }, "successful");
  assert.equal(webhook.transactionDateMs, earlierToday);
  assert.equal(webhook.transactionDateLabel, "Payment verified");
  const created = transactionTimestamp({ createdAt: yesterday, updatedAt: latest, lastReconciledAt: latest }, "successful");
  assert.equal(created.transactionDateMs, yesterday);
  assert.equal(created.transactionDateLabel, "Transaction created");
});

test("pending and failed records use their relevant event timestamps", () => {
  assert.equal(transactionTimestamp({ pendingAt: earlierToday, createdAt: yesterday }, "pending").transactionDateLabel, "Payment pending");
  assert.equal(transactionTimestamp({ failedAt: latest, createdAt: yesterday }, "failed").transactionDateLabel, "Payment failed");
  assert.equal(transactionTimestamp({ failedAt: latest }, "user_dropped").transactionDateLabel, "User dropped");
});

test("order creation fallback is explicitly labelled and never called payment completion", () => {
  const result = transactionTimestamp({}, "pending", { createdAt: yesterday });
  assert.equal(result.transactionDateMs, yesterday);
  assert.equal(result.transactionDateLabel, "Order created");
  assert.equal(result.transactionDateSource, "order_created");
});

test("missing trustworthy timestamps remain unavailable", () => {
  const result = transactionTimestamp({ updatedAt: latest, lastReconciledAt: latest }, "pending");
  assert.equal(result.transactionDateMs, null);
  assert.equal(result.transactionDateAt, null);
  assert.equal(result.transactionDateIst, "Transaction date unavailable");
});

const transactions = [
  { id: "latest", transactionDateMs: latest },
  { id: "today-earlier", transactionDateMs: earlierToday },
  { id: "yesterday", transactionDateMs: yesterday },
  { id: "missing-b", transactionDateMs: null },
  { id: "missing-a", transactionDateMs: null }
];

test("newest-first orders today's latest transaction before yesterday and missing dates", () => {
  assert.deepEqual(sortTransactions(transactions).map((item) => item.id), ["latest", "today-earlier", "yesterday", "missing-a", "missing-b"]);
});

test("oldest-first reverses valid records while missing dates stay last", () => {
  assert.deepEqual(sortTransactions(transactions, "transaction_asc").map((item) => item.id), ["yesterday", "today-earlier", "latest", "missing-a", "missing-b"]);
});

test("sorting occurs before pagination with no skipped or duplicate IDs", () => {
  const sorted = sortTransactions(transactions);
  const pages = [1, 2, 3].flatMap((page) => paginateTransactions(sorted, { page, pageSize: 2 }).items);
  assert.deepEqual(pages.map((item) => item.id), ["latest", "today-earlier", "yesterday", "missing-a", "missing-b"]);
  assert.equal(new Set(pages.map((item) => item.id)).size, transactions.length);
});

test("filters apply before global sorting and pagination while preserving direction", () => {
  const result = prepareTransactions(transactions, { page: 1, pageSize: 2, sort: "transaction_asc" }, (item) => item.id !== "yesterday");
  assert.deepEqual(result.items.map((item) => item.id), ["today-earlier", "latest"]);
  assert.equal(result.total, 4);
});

test("normalization exposes identical API and CSV-ready IST timestamp fields", () => {
  const transaction = normalizeTransaction("tx-1", { status: "SUCCESS", verified: true, capturedAt: "2026-09-15T06:18:00.000Z", createdAt: "2026-09-15T05:00:00.000Z" });
  assert.equal(transaction.transactionDateAt, "2026-09-15T06:18:00.000Z");
  assert.equal(transaction.transactionDateIst, "15 Sep 2026, 11:48 AM IST");
  assert.equal(transaction.transactionDateLabel, "Payment completed");
  assert.equal(formatTransactionDateIst("invalid"), "Transaction date unavailable");
});
