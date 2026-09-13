import test from "node:test";
import assert from "node:assert/strict";
import { buildEmailTemplate, classifyResendFailure, escapeEmailHtml, isValidEmail } from "../server/_lib/notifications.js";

test("validates recipient email addresses", () => {
  assert.equal(isValidEmail("student@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("a @example.com"), false);
});

test("escapes all user-controlled HTML characters", () => {
  assert.equal(escapeEmailHtml('<script data-x="1">Tom & Jerry\'s</script>'), "&lt;script data-x=&quot;1&quot;&gt;Tom &amp; Jerry&#39;s&lt;/script&gt;");
});

test("generates branded responsive HTML and readable text from safe data", () => {
  const output = buildEmailTemplate({ eventType: "payment_successful", title: "Paid", destination: "//evil.example", templateData: { studentName: "<Student>", planName: "Gold & Plus", durationLabel: "6 months", amount: "999", currency: "INR", orderId: "order-123" } });
  assert.match(output.subject, /Payment successful/);
  assert.match(output.html, /Delight Banking/);
  assert.match(output.html, /&lt;Student&gt;/);
  assert.doesNotMatch(output.html, /evil\.example/);
  assert.match(output.text, /Order ID: order-123/);
  assert.match(output.text, /support@delightguidance\.com/);
});

test("classifies permanent and retryable provider failures", () => {
  assert.deepEqual(classifyResendFailure(422, "validation_error"), { retryable: false, status: "permanent_failure" });
  assert.deepEqual(classifyResendFailure(429, "rate_limit_exceeded"), { retryable: true, status: "failed" });
  assert.deepEqual(classifyResendFailure(503, "server_error"), { retryable: true, status: "failed" });
});