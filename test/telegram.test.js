import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTelegramFailure,
  createSignedConnectionToken,
  escapeTelegramHtml,
  isConnectionTokenRecordUsable,
  isTelegramWebhookSecretValid,
  telegramPreferenceAllowed,
  telegramWebhookSecret,
  verifySignedConnectionToken
} from "../server/_lib/telegram.js";

const secret = "test-only-connection-secret-with-entropy";

test("creates an opaque Telegram-compatible signed connection token", () => {
  const token = createSignedConnectionToken(secret);
  assert.equal(token.length <= 64, true);
  assert.equal(token.includes("uid"), false);
  assert.equal(token.includes("@"), false);
  assert.equal(verifySignedConnectionToken(token, secret), true);
  assert.equal(verifySignedConnectionToken(token.slice(0, -1) + "x", secret), false);
  assert.equal(verifySignedConnectionToken(token, "different-secret"), false);
});

test("rejects expired and used connection records", () => {
  const now = Date.now();
  assert.equal(isConnectionTokenRecordUsable({ uid: "user-1", expiresAt: new Date(now + 1_000), usedAt: null }, now), true);
  assert.equal(isConnectionTokenRecordUsable({ uid: "user-1", expiresAt: new Date(now - 1), usedAt: null }, now), false);
  assert.equal(isConnectionTokenRecordUsable({ uid: "user-1", expiresAt: new Date(now + 1_000), usedAt: new Date() }, now), false);
});

test("authenticates webhook secrets without exposing the source secret", () => {
  const derived = telegramWebhookSecret(secret);
  assert.notEqual(derived, secret);
  assert.equal(isTelegramWebhookSecretValid(derived, secret), true);
  assert.equal(isTelegramWebhookSecretValid(derived + "x", secret), false);
});

test("escapes Telegram HTML and applies preference rules", () => {
  assert.equal(escapeTelegramHtml("<Student> & coach"), "&lt;Student&gt; &amp; coach");
  assert.equal(telegramPreferenceAllowed("payment_successful", {}), true);
  assert.equal(telegramPreferenceAllowed("payment_successful", { telegram: false }), false);
  assert.equal(telegramPreferenceAllowed("announcement", { telegram: true, marketing: false }), false);
  assert.equal(telegramPreferenceAllowed("announcement", { telegram: true, marketing: true }), true);
});

test("classifies rate limits, blocked chats, credentials, and transient failures", () => {
  assert.deepEqual(classifyTelegramFailure(429, "Too Many Requests", { retry_after: 17 }), { retryable: true, status: "failed", retryAfter: 17 });
  assert.deepEqual(classifyTelegramFailure(403, "Forbidden: bot was blocked by the user"), { retryable: false, status: "permanent_failure", disconnect: true });
  assert.deepEqual(classifyTelegramFailure(401, "Unauthorized"), { retryable: false, status: "configuration_required" });
  assert.deepEqual(classifyTelegramFailure(503, "upstream unavailable"), { retryable: true, status: "failed", retryAfter: 60 });
});