import { getDb, serverTimestamp, fieldValue } from "./firebaseAdmin.js";
import { hasPermission, writeAdminActivityLog } from "./adminAuth.js";
import { plans as staticPlans } from "./plans.js";

const PLAN_STATUSES = new Set(["draft", "active", "published", "unpublished", "archived", "trashed"]);
const VARIANT_STATUSES = new Set(["draft", "active", "published", "disabled", "archived"]);

function error(statusCode, message, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

function cleanText(value, max = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function slugify(value) {
  return cleanText(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function listValue(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item, 180)).filter(Boolean);
  return String(value || "").split(/[\n,]/).map((item) => cleanText(item, 180)).filter(Boolean);
}

function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function serializeDate(value) {
  return value?.toDate ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value || null;
}

function staticPlan(planId) {
  return staticPlans.find((plan) => plan.planId === planId) || null;
}

function normalizeVariant(data = {}, planId = "") {
  const variantId = cleanText(data.variantId || data.id || `${planId}-${slugify(data.durationLabel || data.displayLabel || "variant")}`, 160);
  const priceInRupees = numberValue(data.offerPriceInRupees ?? data.priceInRupees, 0);
  return {
    id: variantId,
    variantId,
    planId: cleanText(data.planId || planId, 160),
    durationLabel: cleanText(data.durationLabel || data.displayLabel || "1 month", 80),
    displayLabel: cleanText(data.displayLabel || data.durationLabel || "1 month", 80),
    regularPriceInRupees: numberValue(data.regularPriceInRupees ?? data.priceInRupees ?? priceInRupees, priceInRupees),
    offerPriceInRupees: priceInRupees,
    priceInRupees,
    priceInPaise: Math.round(priceInRupees * 100),
    currency: cleanText(data.currency || "INR", 8).toUpperCase(),
    validityMode: cleanText(data.validityMode || "fixed_months", 40),
    validityValue: numberValue(data.validityValue ?? data.durationMonths, 1),
    durationMonths: numberValue(data.durationMonths ?? data.validityValue, 1),
    availabilityStart: serializeDate(data.availabilityStart),
    availabilityEnd: serializeDate(data.availabilityEnd),
    purchaseEnabled: data.purchaseEnabled !== false,
    maxSeats: numberValue(data.maxSeats, 0),
    status: VARIANT_STATUSES.has(data.status) ? data.status : data.active === false ? "disabled" : "active",
    active: data.active !== false && data.status !== "disabled" && data.status !== "archived",
    sortOrder: numberValue(data.sortOrder, 0),
    publicNote: cleanText(data.publicNote || "", 300),
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    createdBy: data.createdBy || "",
    updatedBy: data.updatedBy || ""
  };
}

function normalizePlan(data = {}, variants = []) {
  const planId = cleanText(data.planId || data.id || slugify(data.name || "plan"), 160);
  return {
    id: planId,
    planId,
    slug: slugify(data.slug || data.name || planId),
    name: cleanText(data.name || "Untitled plan", 140),
    shortName: cleanText(data.shortName || data.name || "", 80),
    subtitle: cleanText(data.subtitle || "", 220),
    coverage: cleanText(data.coverage || "", 220),
    description: String(data.description || "").trim().slice(0, 2500),
    bannerImage: String(data.bannerImage || "").trim().slice(0, 600),
    cardImage: String(data.cardImage || "").trim().slice(0, 600),
    examCategories: listValue(data.examCategories || data.accessTags),
    accessTags: listValue(data.accessTags || data.examCategories),
    eligibility: String(data.eligibility || "").trim().slice(0, 1200),
    mentorName: cleanText(data.mentorName || "Imran Sir", 120),
    features: listValue(data.features),
    benefits: listValue(data.benefits),
    supportDetails: String(data.supportDetails || "").trim().slice(0, 1200),
    badgeText: cleanText(data.badgeText || "", 80),
    terms: String(data.terms || "").trim().slice(0, 1200),
    temporary: boolValue(data.temporary, false),
    featured: boolValue(data.featured, false),
    homepageVisible: data.homepageVisible !== false,
    purchaseVisible: data.purchaseVisible !== false,
    displayOrder: numberValue(data.displayOrder, 100),
    availabilityStart: serializeDate(data.availabilityStart),
    availabilityEnd: serializeDate(data.availabilityEnd),
    offerTitle: cleanText(data.offerTitle || data.offerLabel || "", 120),
    offerStart: serializeDate(data.offerStart),
    offerEnd: serializeDate(data.offerEnd),
    status: PLAN_STATUSES.has(data.status) ? data.status : data.active === false ? "unpublished" : "active",
    active: data.active !== false && !["unpublished", "archived", "trashed"].includes(data.status),
    variants: variants.map((variant) => normalizeVariant(variant, planId)).sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    createdBy: data.createdBy || "",
    updatedBy: data.updatedBy || ""
  };
}

function assertView(admin) {
  if (!hasPermission(admin, "plans.view") && !hasPermission(admin, "plans.manage")) throw error(403, "This administrator cannot view plans.");
}

function assertManage(admin) {
  if (!hasPermission(admin, "plans.manage")) throw error(403, "This administrator cannot manage plans.");
}

function assertSuper(admin) {
  if (admin.role !== "super_admin") throw error(403, "Only super administrators can permanently delete unused plans.");
}

async function readFirestorePlans() {
  const db = getDb();
  const [planSnap, variantSnap] = await Promise.all([
    db.collection("plans").get(),
    db.collection("planVariants").get()
  ]);
  const variantsByPlan = new Map();
  variantSnap.docs.forEach((doc) => {
    const data = { id: doc.id, variantId: doc.id, ...doc.data() };
    const planId = data.planId;
    if (!variantsByPlan.has(planId)) variantsByPlan.set(planId, []);
    variantsByPlan.get(planId).push(data);
  });
  return planSnap.docs.map((doc) => normalizePlan({ id: doc.id, planId: doc.id, ...doc.data() }, variantsByPlan.get(doc.id) || []));
}

export async function listEffectivePlans({ publicOnly = false } = {}) {
  let items = [];
  try {
    items = await readFirestorePlans();
  } catch (cause) {
    if (process.env.NODE_ENV === "production") throw cause;
  }
  if (!items.length) items = staticPlans.map((plan) => normalizePlan(plan, plan.variants || []));
  const now = Date.now();
  const visible = publicOnly ? items.filter((plan) => {
    if (!plan.homepageVisible || !plan.purchaseVisible) return false;
    if (!["active", "published"].includes(plan.status)) return false;
    const start = plan.availabilityStart ? new Date(plan.availabilityStart).getTime() : null;
    const end = plan.availabilityEnd ? new Date(plan.availabilityEnd).getTime() : null;
    return (!start || start <= now) && (!end || end >= now);
  }).map((plan) => ({ ...plan, variants: plan.variants.filter((variant) => isVariantPurchasable(plan, variant)) })) : items;
  return visible.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

export function isVariantPurchasable(plan, variant) {
  if (!plan || !variant) return false;
  if (!["active", "published"].includes(plan.status)) return false;
  if (!["active", "published"].includes(variant.status)) return false;
  if (!plan.purchaseVisible || variant.purchaseEnabled === false || variant.active === false) return false;
  const now = Date.now();
  const start = variant.availabilityStart ? new Date(variant.availabilityStart).getTime() : null;
  const end = variant.availabilityEnd ? new Date(variant.availabilityEnd).getTime() : null;
  return (!start || start <= now) && (!end || end >= now);
}

export async function getCheckoutVariant(variantId) {
  const id = cleanText(variantId, 160);
  const plans = await listEffectivePlans({ publicOnly: false });
  for (const plan of plans) {
    const variant = plan.variants.find((item) => item.variantId === id);
    if (variant && isVariantPurchasable(plan, variant)) return { plan, variant };
  }
  return null;
}

export function planSnapshot(plan, variant) {
  const priceInRupees = variant.offerPriceInRupees ?? variant.priceInRupees;
  return {
    planId: plan.planId,
    name: plan.name,
    subtitle: plan.subtitle,
    coverage: plan.coverage,
    description: plan.description,
    benefits: plan.benefits,
    accessTags: plan.accessTags,
    featured: plan.featured,
    temporary: Boolean(plan.temporary),
    offerLabel: plan.offerTitle || plan.offerLabel || "",
    variantId: variant.variantId,
    durationLabel: variant.durationLabel || variant.displayLabel,
    durationMonths: variant.durationMonths || variant.validityValue || 1,
    validityMode: variant.validityMode || "fixed_months",
    validityValue: variant.validityValue || variant.durationMonths || 1,
    accessEndDate: variant.accessEndDate || null,
    priceInRupees,
    priceInPaise: priceInRupees * 100,
    currency: variant.currency || "INR"
  };
}

async function dependencyCounts(planId, variantId = "") {
  const db = getDb();
  const checks = [
    ["orders", "planId", planId],
    ["subscriptions", "planId", planId],
    ["transactions", "planId", planId],
    ["resources", "planIds", planId, "array-contains"],
    ["targets", "planIds", planId, "array-contains"],
    ["classes", "planIds", planId, "array-contains"]
  ];
  if (variantId) {
    checks.push(["orders", "variantId", variantId], ["subscriptions", "variantId", variantId], ["transactions", "variantId", variantId]);
  }
  const results = await Promise.all(checks.map(([collection, field, value, op]) => db.collection(collection).where(field, op || "==", value).limit(1).get().then((snap) => [collection, !snap.empty])));
  return Object.fromEntries(results.filter(([, found]) => found));
}

async function getPlanWithVariants(planId) {
  const db = getDb();
  const [planSnap, variantSnap] = await Promise.all([
    db.collection("plans").doc(planId).get(),
    db.collection("planVariants").where("planId", "==", planId).get()
  ]);
  if (planSnap.exists) return normalizePlan({ id: planSnap.id, planId: planSnap.id, ...planSnap.data() }, variantSnap.docs.map((doc) => ({ id: doc.id, variantId: doc.id, ...doc.data() })));
  const fallback = staticPlan(planId);
  if (!fallback) throw error(404, "Plan not found.", "PLAN_NOT_FOUND");
  return normalizePlan(fallback, fallback.variants || []);
}

function planWriteData(body, admin, existing = null, status = null) {
  const plan = normalizePlan({ ...(existing || {}), ...body, status: status || body.status || existing?.status });
  if (!plan.name || plan.name.length < 2) throw error(400, "Plan name is required.");
  if (!plan.slug) throw error(400, "Plan slug is required.");
  return {
    planId: plan.planId,
    slug: plan.slug,
    name: plan.name,
    shortName: plan.shortName,
    subtitle: plan.subtitle,
    coverage: plan.coverage,
    description: plan.description,
    bannerImage: plan.bannerImage,
    cardImage: plan.cardImage,
    examCategories: plan.examCategories,
    accessTags: plan.accessTags,
    eligibility: plan.eligibility,
    mentorName: plan.mentorName,
    features: plan.features,
    benefits: plan.benefits,
    supportDetails: plan.supportDetails,
    badgeText: plan.badgeText,
    terms: plan.terms,
    temporary: plan.temporary,
    featured: plan.featured,
    homepageVisible: plan.homepageVisible,
    purchaseVisible: plan.purchaseVisible,
    displayOrder: plan.displayOrder,
    availabilityStart: plan.availabilityStart || null,
    availabilityEnd: plan.availabilityEnd || null,
    offerTitle: plan.offerTitle,
    offerStart: plan.offerStart || null,
    offerEnd: plan.offerEnd || null,
    status: plan.status,
    active: plan.active,
    updatedBy: admin.uid,
    updatedByEmail: admin.email || "",
    updatedAt: serverTimestamp(),
    createdBy: existing?.createdBy || admin.uid,
    createdByEmail: existing?.createdByEmail || admin.email || "",
    createdAt: existing?.createdAt || serverTimestamp()
  };
}

async function writeVariants(planId, variants = [], admin) {
  const db = getDb();
  const batch = db.batch();
  for (const input of variants) {
    const variant = normalizeVariant(input, planId);
    if (!variant.variantId) throw error(400, "Variant ID is required.");
    if (!variant.durationLabel) throw error(400, "Variant label is required.");
    if (variant.priceInRupees <= 0) throw error(400, "Variant price must be greater than zero.");
    batch.set(db.collection("planVariants").doc(variant.variantId), {
      ...variant,
      planId,
      updatedBy: admin.uid,
      updatedByEmail: admin.email || "",
      updatedAt: serverTimestamp(),
      createdBy: variant.createdBy || admin.uid,
      createdByEmail: variant.createdByEmail || admin.email || "",
      createdAt: variant.createdAt || serverTimestamp()
    }, { merge: true });
  }
  await batch.commit();
}

export async function listAdminPlans(admin, query = {}) {
  assertView(admin);
  const plans = await listEffectivePlans({ publicOnly: false });
  const includeTrashed = query.status === "trashed" || query.includeTrashed === "1";
  const items = plans.filter((plan) => includeTrashed || plan.status !== "trashed");
  return { plans: { items, total: items.length, page: 1, pageSize: items.length, hasMore: false } };
}

export async function getAdminPlan(admin, planId) {
  assertView(admin);
  const plan = await getPlanWithVariants(cleanText(planId, 160));
  const deps = await dependencyCounts(plan.planId);
  return { plan: { ...plan, dependencySummary: Object.keys(deps) }, metrics: { subscriberCount: 0, purchaseCount: 0, verifiedRevenue: 0 }, assigned: deps };
}

export async function createPlan(admin, body = {}) {
  assertManage(admin);
  const planId = slugify(body.planId || body.slug || body.name);
  if (!planId) throw error(400, "Plan ID or name is required.");
  const db = getDb();
  const ref = db.collection("plans").doc(planId);
  const existing = await ref.get();
  if (existing.exists) throw error(400, "A plan with this ID already exists.");
  const data = planWriteData({ ...body, planId, status: body.status || "draft" }, admin, null);
  await ref.set(data);
  await writeVariants(planId, body.variants || [], admin);
  await writeAdminActivityLog({ admin, action: "plan.create", entityType: "plan", entityId: planId, safeMetadata: { status: data.status } });
  return getAdminPlan(admin, planId);
}

export async function updatePlan(admin, planId, body = {}) {
  assertManage(admin);
  const current = await getPlanWithVariants(planId);
  const db = getDb();
  const data = planWriteData({ ...body, planId: current.planId }, admin, current);
  await db.collection("plans").doc(current.planId).set(data, { merge: true });
  if (Array.isArray(body.variants)) await writeVariants(current.planId, body.variants, admin);
  await writeAdminActivityLog({ admin, action: "plan.update", entityType: "plan", entityId: current.planId, safeMetadata: { fields: Object.keys(body).filter((key) => key !== "variants") } });
  return getAdminPlan(admin, current.planId);
}

export async function duplicatePlan(admin, planId) {
  assertManage(admin);
  const source = await getPlanWithVariants(planId);
  const nextId = `${source.planId}-copy-${Date.now().toString(36)}`.slice(0, 150);
  const copy = { ...source, planId: nextId, slug: `${source.slug}-copy`, name: `${source.name} Copy`, status: "draft", active: false, variants: source.variants.map((variant, index) => ({ ...variant, variantId: `${nextId}-${index + 1}`, status: "draft", active: false, purchaseEnabled: false })) };
  const result = await createPlan(admin, copy);
  await writeAdminActivityLog({ admin, action: "plan.duplicate", entityType: "plan", entityId: nextId, safeMetadata: { sourcePlanId: source.planId } });
  return result;
}

export async function setPlanStatus(admin, planId, status) {
  assertManage(admin);
  if (!PLAN_STATUSES.has(status)) throw error(400, "Invalid plan status.");
  const current = await getPlanWithVariants(planId);
  await getDb().collection("plans").doc(current.planId).set({ status, active: ["active", "published"].includes(status), updatedBy: admin.uid, updatedByEmail: admin.email || "", updatedAt: serverTimestamp() }, { merge: true });
  await writeAdminActivityLog({ admin, action: `plan.${status}`, entityType: "plan", entityId: current.planId, safeMetadata: {} });
  return getAdminPlan(admin, current.planId);
}

export async function trashPlan(admin, planId) {
  return setPlanStatus(admin, planId, "trashed");
}

export async function deleteUnusedPlan(admin, planId, body = {}) {
  assertSuper(admin);
  const current = await getPlanWithVariants(planId);
  if (body.confirm !== current.planId) throw error(400, "Type the plan ID to confirm permanent deletion.");
  const deps = await dependencyCounts(current.planId);
  if (Object.keys(deps).length) throw error(400, `Plan has dependent data: ${Object.keys(deps).join(", ")}. Archive it instead.`);
  if (current.status !== "draft" && current.status !== "trashed") throw error(400, "Only unused draft or trashed plans can be permanently deleted.");
  const db = getDb();
  const batch = db.batch();
  batch.delete(db.collection("plans").doc(current.planId));
  current.variants.forEach((variant) => batch.delete(db.collection("planVariants").doc(variant.variantId)));
  await batch.commit();
  await writeAdminActivityLog({ admin, action: "plan.delete_unused", entityType: "plan", entityId: current.planId, safeMetadata: {} });
  return { ok: true, deleted: true, planId: current.planId };
}

export async function updatePlanVariant(admin, body = {}) {
  assertManage(admin);
  const variant = normalizeVariant(body, body.planId);
  if (!variant.planId || !variant.variantId) throw error(400, "Plan ID and variant ID are required.");
  await writeVariants(variant.planId, [variant], admin);
  await writeAdminActivityLog({ admin, action: "plan_variant.update", entityType: "planVariant", entityId: variant.variantId, safeMetadata: { planId: variant.planId } });
  return getAdminPlan(admin, variant.planId);
}

export async function setPlanVariantStatus(admin, variantId, status) {
  assertManage(admin);
  if (!VARIANT_STATUSES.has(status)) throw error(400, "Invalid variant status.");
  const db = getDb();
  const ref = db.collection("planVariants").doc(cleanText(variantId, 160));
  const snap = await ref.get();
  if (!snap.exists) throw error(404, "Variant not found.");
  const planId = snap.data().planId;
  await ref.set({ status, active: ["active", "published"].includes(status), purchaseEnabled: !["disabled", "archived"].includes(status), updatedAt: serverTimestamp(), updatedBy: admin.uid, updatedByEmail: admin.email || "" }, { merge: true });
  await writeAdminActivityLog({ admin, action: `plan_variant.${status}`, entityType: "planVariant", entityId: ref.id, safeMetadata: { planId } });
  return getAdminPlan(admin, planId);
}

export async function deleteUnusedPlanVariant(admin, variantId, body = {}) {
  assertManage(admin);
  const db = getDb();
  const ref = db.collection("planVariants").doc(cleanText(variantId, 160));
  const snap = await ref.get();
  if (!snap.exists) throw error(404, "Variant not found.");
  const data = snap.data();
  const deps = await dependencyCounts(data.planId, ref.id);
  if (Object.keys(deps).length) throw error(400, `Variant has dependent data: ${Object.keys(deps).join(", ")}. Archive it instead.`);
  if (body.confirm && body.confirm !== ref.id) throw error(400, "Type the variant ID to confirm deletion.");
  await ref.delete();
  await writeAdminActivityLog({ admin, action: "plan_variant.delete_unused", entityType: "planVariant", entityId: ref.id, safeMetadata: { planId: data.planId } });
  return getAdminPlan(admin, data.planId);
}
