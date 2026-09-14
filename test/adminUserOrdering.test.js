import test from "node:test";
import assert from "node:assert/strict";
import { listAllAuthUsers, paginateRegisteredUsers, prepareRegisteredUsers, registrationSort, registrationTimestamp } from "../server/_lib/adminUserOrdering.js";
import { normalizeUser } from "../server/_lib/adminNormalizers.js";
import { formatRegistrationDate } from "../src/utils/adminDate.js";

const day = 86_400_000;
const now = Date.parse("2026-09-14T10:00:00.000Z");
const records = [
  { uid: "user-a", registeredAtMs: now },
  { uid: "user-b", registeredAtMs: now - day },
  { uid: "user-c", registeredAtMs: now - 30 * day },
  { uid: "user-d", registeredAtMs: now - 2 * day },
  { uid: "user-e", registeredAtMs: now - 3 * day },
  { uid: "user-f", registeredAtMs: null },
  { uid: "tie-a", registeredAtMs: now - 4 * day },
  { uid: "tie-b", registeredAtMs: now - 4 * day }
];

test("loads every Firebase Auth page and deduplicates UIDs", async () => {
  const calls = [];
  const auth = { async listUsers(_size, token) {
    calls.push(token);
    return token ? { users: [{ uid: "user-a" }, { uid: "user-b" }] } : { users: [{ uid: "user-c" }, { uid: "user-a" }], pageToken: "next" };
  }};
  assert.deepEqual((await listAllAuthUsers(auth)).map((user) => user.uid), ["user-c", "user-a", "user-b"]);
  assert.deepEqual(calls, [undefined, "next"]);
});

test("a newest user from the second Firebase batch becomes first globally", async () => {
  const auth = { async listUsers(_size, token) {
    return token ? { users: [{ uid: "newest", registeredAtMs: now }] } : { users: [{ uid: "older", registeredAtMs: now - day }], pageToken: "next" };
  }};
  assert.equal(registrationSort(await listAllAuthUsers(auth))[0].uid, "newest");
});

test("newest-first globally orders valid timestamps before missing dates", () => {
  assert.deepEqual(registrationSort(records).map((user) => user.uid), ["user-a", "user-b", "user-d", "user-e", "tie-a", "tie-b", "user-c", "user-f"]);
});

test("oldest-first globally orders valid timestamps before missing dates", () => {
  assert.deepEqual(registrationSort(records, "registered_asc").map((user) => user.uid), ["user-c", "tie-a", "tie-b", "user-e", "user-d", "user-b", "user-a", "user-f"]);
});

test("equal registration timestamps use ascending UID as deterministic tiebreaker", () => {
  assert.deepEqual(registrationSort([records[7], records[6]]).map((user) => user.uid), ["tie-a", "tie-b"]);
});

test("pagination happens after global sorting", () => {
  const result = paginateRegisteredUsers(registrationSort(records), { page: 2, pageSize: 3 });
  assert.deepEqual(result.items.map((user) => user.uid), ["user-e", "tie-a", "tie-b"]);
});

test("adjacent pages contain every UID exactly once", () => {
  const sorted = registrationSort(records);
  const pages = [1, 2, 3].flatMap((page) => paginateRegisteredUsers(sorted, { page, pageSize: 3 }).items);
  assert.deepEqual(new Set(pages.map((user) => user.uid)).size, records.length);
  assert.deepEqual(new Set(pages.map((user) => user.uid)), new Set(records.map((user) => user.uid)));
});

test("filters are applied before sorting and pagination", () => {
  const result = prepareRegisteredUsers(records, { page: 1, pageSize: 2 }, (user) => ["user-c", "user-f", "user-b"].includes(user.uid));
  assert.deepEqual(result.items.map((user) => user.uid), ["user-b", "user-c"]);
  assert.equal(result.total, 3);
});

test("Firebase creationTime takes precedence over profile timestamps", () => {
  assert.equal(registrationTimestamp({ metadata: { creationTime: "2026-09-14T10:00:00Z" } }, { createdAt: "2026-09-15T10:00:00Z" }), now);
});

test("invalid profile timestamps safely fall through and missing timestamps stay null", () => {
  assert.equal(registrationTimestamp({ metadata: {} }, { createdAt: "invalid", registeredAt: "2026-09-13T10:00:00Z" }), now - day);
  assert.equal(registrationTimestamp({ metadata: {} }, { createdAt: "invalid" }), null);
});

test("last sign-in and updatedAt never determine registration ordering", () => {
  const user = normalizeUser({ uid: "user-f", metadata: { lastSignInTime: "2026-09-14T10:00:00Z" }, providerData: [] }, { updatedAt: "2026-09-14T10:00:00Z" }, []);
  assert.equal(user.registeredAtMs, null);
  assert.equal(user.createdAt, null);
});

test("registration formatting uses Asia/Kolkata across a UTC day boundary", () => {
  const formatted = formatRegistrationDate("2026-09-14T20:35:00.000Z");
  assert.equal(formatted, "15 Sep 2026, 2:05 AM IST");
  assert.equal(formatRegistrationDate("invalid"), "Registration date unavailable");
});
