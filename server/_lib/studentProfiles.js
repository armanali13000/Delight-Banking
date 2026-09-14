import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getDb, requireUser, serverTimestamp } from "./firebaseAdmin.js";

function fail(message, code = "VALIDATION_ERROR") { const error = new Error(message); error.statusCode = 400; error.code = code; throw error; }
function clean(value, max) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, max); }
function cleanMultiline(value, max) { return String(value || "").trim().replace(/\r/g, "").slice(0, max); }
export function normalizeMobile(countryCode = "+91", mobile = "") {
  const code = clean(countryCode, 5).replace(/[^+\d]/g, "");
  let digits = clean(mobile, 30).replace(/[\s()-]/g, "");
  if (/[A-Za-z]/.test(String(mobile)) || !/^\+?\d+$/.test(digits)) fail("Enter a valid mobile number without letters.", "INVALID_MOBILE");
  if (digits.startsWith("+")) { if (!/^\+[1-9]\d{7,14}$/.test(digits)) fail("Enter a valid mobile number in international format.", "INVALID_MOBILE"); return digits; }
  digits = digits.replace(/^0+/, "");
  const prefix = /^\+[1-9]\d{0,3}$/.test(code) ? code : "+91";
  const normalized = prefix + digits;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized) || (prefix === "+91" && digits.length !== 10)) fail("Enter a valid mobile number. Indian numbers must contain 10 digits.", "INVALID_MOBILE");
  return normalized;
}
export function profileComplete(profile = {}) { return Boolean(clean(profile.fullName || profile.name, 120) && /^\+[1-9]\d{7,14}$/.test(String(profile.mobile || profile.phone || ""))); }
function sanitize(body = {}) {
  const fullName = clean(body.fullName || body.name, 120); if (fullName.length < 2) fail("Enter your full name.");
  const mobile = normalizeMobile(body.countryCode || "+91", body.mobile || body.phone);
  const dateOfBirth = clean(body.dateOfBirth, 10); if (dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || new Date(dateOfBirth) > new Date())) fail("Enter a valid date of birth.");
  const postalCode = clean(body.postalCode || body.pinCode, 12); if (postalCode && !/^[A-Za-z0-9 -]{3,12}$/.test(postalCode)) fail("Enter a valid postal or PIN code.");
  const photoURL = clean(body.photoURL || body.photo, 500); if (photoURL && !/^https:\/\//i.test(photoURL)) fail("Profile photograph must be a secure image URL.");
  const examInterests = Array.isArray(body.examInterests) ? body.examInterests : String(body.examInterests || body.targetExam || "").split(",");
  return { fullName, name: fullName, countryCode: mobile.startsWith("+91") ? "+91" : clean(body.countryCode, 5), mobile, phone: mobile, mobileVerified: false, dateOfBirth, city: clean(body.city, 80), state: clean(body.state, 80), country: clean(body.country || "India", 80), address: cleanMultiline(body.address || body.location, 500), postalCode, photoURL, photo: photoURL, examInterests: examInterests.map((v) => clean(v, 80)).filter(Boolean).slice(0, 12) };
}
function iso(value) { return value?.toDate ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value || null; }
function providerOf(user) { return user.firebase?.sign_in_provider || "unknown"; }
function response(user, data = {}, authUser = null) { const provider=authUser?.providerData?.some(item=>item.providerId==="google.com")?"google.com":authUser?.providerData?.some(item=>item.providerId==="password")?"password":providerOf(user); return { profile: { ...data, fullName: data.fullName || data.name || authUser?.displayName || user.name || "", mobile: data.mobile || data.phone || "", countryCode: data.countryCode || "+91", email: authUser?.email || user.email || "", provider, profileComplete: profileComplete(data), createdAt: iso(authUser?.metadata?.creationTime || data.createdAt) || null, updatedAt: iso(data.updatedAt) || null } }; }
export async function getStudentProfile(req) { const user = await requireUser(req); const [snap,authUser]=await Promise.all([getDb().collection("students").doc(user.uid).get(),getAuth(getAdminApp()).getUser(user.uid)]); return response(user, snap.exists ? snap.data() : {}, authUser); }
export async function saveStudentProfile(req, body = {}) { const user = await requireUser(req); const payload = sanitize(body); const ref = getDb().collection("students").doc(user.uid); await getDb().runTransaction(async (tx) => { const snap = await tx.get(ref); tx.set(ref, { ...payload, uid: user.uid, email: user.email || "", provider: providerOf(user), profileComplete: true, updatedAt: serverTimestamp(), ...(snap.exists ? {} : { createdAt: serverTimestamp() }) }, { merge: true }); }); return getStudentProfile(req); }
export async function requireCompleteProfile(user) { const snap = await getDb().collection("students").doc(user.uid).get(); if (!snap.exists || !profileComplete(snap.data())) { const error = new Error("Complete your profile with your full name and mobile number before checkout."); error.statusCode = 409; error.code = "PROFILE_INCOMPLETE"; throw error; } return snap.data(); }