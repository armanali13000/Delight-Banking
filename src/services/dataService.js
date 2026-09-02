import { firebaseConfig, seedResources } from "../config.js";

export const hasFirebaseConfig = Object.values(firebaseConfig).every((value) => {
  return typeof value === "string" && value.trim() && !value.includes("PASTE_");
});
let firebaseReady = null;

async function getFirebase() {
  if (!hasFirebaseConfig) return null;
  if (firebaseReady) return firebaseReady;

  firebaseReady = Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js")
  ]).then(([appModule, authModule, firestoreModule, storageModule]) => {
    const app = appModule.initializeApp(firebaseConfig);
    return {
      appModule,
      authModule,
      firestoreModule,
      storageModule,
      app,
      auth: authModule.getAuth(app),
      db: firestoreModule.getFirestore(app),
      storage: storageModule.getStorage(app)
    };
  });

  return firebaseReady;
}

const storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      localStorage.removeItem(key);
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

function isAdminEmail() {
  return false;
}

function removeLocalStudent(email) {
  const students = storage.get("db_students", {});
  const targetEmail = email.toLowerCase();
  let changed = false;

  Object.keys(students).forEach((studentEmail) => {
    if (studentEmail.toLowerCase() === targetEmail) {
      delete students[studentEmail];
      changed = true;
    }
  });

  if (changed) storage.set("db_students", students);
}

export async function listenToAuth(callback) {
  const fb = await getFirebase();
  if (!fb) {
    const user = storage.get("db_user", null);
    if (user) rememberStudent(user);
    callback(user);
    return () => {};
  }
  return fb.authModule.onAuthStateChanged(fb.auth, (user) => {
    if (user) rememberStudent(user);
    callback(user);
  });
}

export async function signInWithGoogle(options = {}) {
  const fb = await getFirebase();
  if (!fb) {
    throw new Error("Google login needs Firebase setup first. Add Firebase keys in src/config.js.");
  }

  const provider = new fb.authModule.GoogleAuthProvider();
  if (options.selectAccount) provider.setCustomParameters({ prompt: "select_account" });
  const result = await fb.authModule.signInWithPopup(fb.auth, provider);
  rememberStudent(result.user);
  return result.user;
}

export async function signInWithEmail(email, password, mode) {
  const fb = await getFirebase();
  if (!email || password.length < 6) {
    throw new Error("Enter email and minimum 6 character password.");
  }

  if (!fb) {
    const user = { uid: email, email, displayName: email.split("@")[0] };
    storage.set("db_user", user);
    rememberStudent(user);
    return user;
  }

  const action = mode === "signup"
    ? fb.authModule.createUserWithEmailAndPassword
    : fb.authModule.signInWithEmailAndPassword;
  const result = await action(fb.auth, email, password);
  rememberStudent(result.user);
  return result.user;
}

export async function resetPassword(email) {
  if (!email) throw new Error("Enter your email first.");
  const fb = await getFirebase();
  if (!fb) return true;
  await fb.authModule.sendPasswordResetEmail(fb.auth, email);
  return true;
}

export async function signOutUser() {
  const fb = await getFirebase();
  if (!fb) {
    localStorage.removeItem("db_user");
    return;
  }
  await fb.authModule.signOut(fb.auth);
}

export async function reauthenticateCurrentUser(password = "", options = {}) {
  const fb = await getFirebase();
  const user = fb?.auth?.currentUser;
  if (!user) throw new Error("Login required.");

  const providerIds = user.providerData.map((provider) => provider.providerId);
  if (providerIds.includes("google.com")) {
    const provider = new fb.authModule.GoogleAuthProvider();
    if (options.selectAccount !== false) provider.setCustomParameters({ prompt: "select_account" });
    await fb.authModule.reauthenticateWithPopup(user, provider);
  } else {
    if (!user.email || !password) throw new Error("Enter your password to reauthenticate.");
    const credential = fb.authModule.EmailAuthProvider.credential(user.email, password);
    await fb.authModule.reauthenticateWithCredential(user, credential);
  }

  await user.getIdToken(true);
  return true;
}

export async function getResources() {
  const fb = await getFirebase();
  if (!fb) return storage.get("db_resources", seedResources);

  try {
    const snapshot = await fb.firestoreModule.getDocs(fb.firestoreModule.collection(fb.db, "resources"));
    if (snapshot.empty) return seedResources;
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Unable to load Firestore resources", error);
    return storage.get("db_resources", seedResources);
  }
}

export async function addResource(resource) {
  const payload = { ...resource, createdAt: new Date().toISOString() };
  const fb = await getFirebase();

  if (!fb) {
    const resources = storage.get("db_resources", seedResources);
    const next = [{ ...payload, id: crypto.randomUUID() }, ...resources];
    storage.set("db_resources", next);
    return next[0];
  }

  try {
    const ref = await fb.firestoreModule.addDoc(fb.firestoreModule.collection(fb.db, "resources"), payload);
    return { id: ref.id, ...payload };
  } catch (error) {
    throw new Error(getFirebaseWriteError(error));
  }
}

export async function deleteResource(id) {
  const fb = await getFirebase();
  if (!fb) {
    storage.set("db_resources", storage.get("db_resources", seedResources).filter((item) => item.id !== id));
    return;
  }
  try {
    await fb.firestoreModule.deleteDoc(fb.firestoreModule.doc(fb.db, "resources", id));
  } catch (error) {
    throw new Error(getFirebaseWriteError(error));
  }
}

function getFirebaseWriteError(error) {
  if (error?.code === "permission-denied") {
    return "Firestore denied this action. Add your admin email in Firestore rules and publish the rules.";
  }
  if (error?.code === "unavailable" || error?.code === "not-found") {
    return "Firestore is not ready. Create a Firestore Database in Firebase Console first.";
  }
  return error?.message || "Resource could not be saved.";
}

export function getStudyTracking(email) {
  if (!email) return getDefaultTracking();
  const allTracking = storage.get("db_tracking", {});
  return normalizeTracking(allTracking[email]);
}

export function saveStudyTracking(email, tracking) {
  if (!email) throw new Error("Login required.");
  const allTracking = storage.get("db_tracking", {});
  const defaultTracking = getDefaultTracking();
  const nextTracking = {
    ...defaultTracking,
    ...normalizeTracking(allTracking[email]),
    ...tracking
  };

  allTracking[email] = {
    ...nextTracking,
    weeklyHours: Array.isArray(nextTracking.weeklyHours) && nextTracking.weeklyHours.length === 7
      ? nextTracking.weeklyHours.map((hours) => Number(hours || 0))
      : defaultTracking.weeklyHours,
    subjects: {
      ...defaultTracking.subjects,
      ...(nextTracking.subjects || {})
    },
    weekKey: getWeekKey(),
    lastStudyDate: getDateKey(),
    updatedAt: new Date().toISOString()
  };
  storage.set("db_tracking", allTracking);
  rememberStudent({ email }, { tracking: allTracking[email] });
  return allTracking[email];
}

function getDefaultTracking() {
  return {
    weekKey: getWeekKey(),
    lastStudyDate: "",
    targetHours: 6,
    completedHours: 0,
    mocksAttempted: 0,
    accuracy: 0,
    weeklyHours: [0, 0, 0, 0, 0, 0, 0],
    subjects: {
      Quant: 0,
      Reasoning: 0,
      English: 0,
      "Current Affairs": 0
    }
  };
}

function normalizeTracking(tracking) {
  if (!tracking || isDemoTracking(tracking)) return getDefaultTracking();
  const defaultTracking = getDefaultTracking();
  const trackingWeekKey = tracking.weekKey || getWeekKeyFromTimestamp(tracking.updatedAt);
  const trackingDateKey = tracking.lastStudyDate || getDateKeyFromTimestamp(tracking.updatedAt);
  const isCurrentWeek = trackingWeekKey === getWeekKey();
  const isToday = trackingDateKey === getDateKey();

  return {
    ...defaultTracking,
    ...tracking,
    weekKey: getWeekKey(),
    lastStudyDate: isToday ? trackingDateKey : "",
    completedHours: isToday ? Number(tracking.completedHours || 0) : 0,
    weeklyHours: isCurrentWeek && Array.isArray(tracking.weeklyHours) && tracking.weeklyHours.length === 7
      ? tracking.weeklyHours.map((hours) => Number(hours || 0))
      : defaultTracking.weeklyHours,
    subjects: {
      ...defaultTracking.subjects,
      ...(tracking.subjects || {})
    }
  };
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateKeyFromTimestamp(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : getDateKey(date);
}

function getWeekKey(date = new Date()) {
  const mondayIndex = (date.getDay() + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayIndex);
  return getDateKey(monday);
}

function getWeekKeyFromTimestamp(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : getWeekKey(date);
}

function isDemoTracking(tracking) {
  if (tracking.updatedAt) return false;

  const demoHours = [2, 3, 1.5, 4, 2.5, 5, 3.5];
  const demoSubjects = {
    Quant: 65,
    Reasoning: 78,
    English: 58,
    "Current Affairs": 45
  };

  return (
    Number(tracking.completedHours) === 2 &&
    Number(tracking.mocksAttempted) === 1 &&
    Number(tracking.accuracy) === 72 &&
    Array.isArray(tracking.weeklyHours) &&
    tracking.weeklyHours.every((hours, index) => Number(hours) === demoHours[index]) &&
    Object.entries(demoSubjects).every(([subject, value]) => Number(tracking.subjects?.[subject]) === value)
  );
}

export function getLocalStudents() {
  const students = storage.get("db_students", {});
  const profiles = storage.get("db_profiles", {});
  const tracking = storage.get("db_tracking", {});

  return Object.values(students).filter((student) => !isAdminEmail(student.email)).map((student) => {
    const profile = profiles[student.email] || {};
    return {
      ...student,
      ...profile,
      activeExams: [],
      tracking: normalizeTracking(tracking[student.email] || student.tracking)
    };
  });
}

export async function getStudents() {
  const fb = await getFirebase();
  if (!fb) return getLocalStudents();

  try {
    const snapshot = await fb.firestoreModule.getDocs(fb.firestoreModule.collection(fb.db, "students"));
    const cloudStudents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const localStudents = getLocalStudents();
    const byEmail = new Map();

    [...cloudStudents, ...localStudents].forEach((student) => {
      if (!student.email || isAdminEmail(student.email)) return;
      byEmail.set(student.email, {
        ...(byEmail.get(student.email) || {}),
        ...student,
        activeExams: student.activeExams || [],
        tracking: normalizeTracking(student.tracking)
      });
    });

    return [...byEmail.values()];
  } catch (error) {
    console.error("Unable to load students", error);
    return getLocalStudents();
  }
}

export function getUserProfile(email) {
  if (!email) return {};
  return storage.get("db_profiles", {})[email] || {};
}

export function saveUserProfile(email, profile) {
  if (!email) throw new Error("Login required.");
  const profiles = storage.get("db_profiles", {});
  profiles[email] = {
    ...(profiles[email] || {}),
    ...profile,
    updatedAt: new Date().toISOString()
  };
  storage.set("db_profiles", profiles);
  rememberStudent({ email, displayName: profiles[email].name }, profiles[email]);
  window.dispatchEvent(new CustomEvent("profile-updated"));
  return profiles[email];
}

export async function getAuthToken(forceRefresh = false) {
  const fb = await getFirebase();
  if (!fb?.auth?.currentUser) throw new Error("Login required.");
  return fb.auth.currentUser.getIdToken(forceRefresh);
}

function friendlyApiError(status, code, message, requestId = "") {
  if (code === "RECENT_LOGIN_REQUIRED") return "Recent authentication is required.";
  if (code === "ADMIN_ALREADY_ACTIVE") return "This user is already an administrator.";
  if (code === "TARGET_EMAIL_UNVERIFIED") return "This email must be verified first.";
  if (code === "TARGET_ACCOUNT_DISABLED") return "This account is disabled.";
  if (code === "MALFORMED_ROUTE_ID" || status === 400) return message || "The requested identifier is malformed.";
  if (status === 401) return "Session expired. Please sign in again.";
  if (status === 403) return message || "Permission denied.";
  if (status === 404) return message || "The requested record was not found.";
  if (status === 405) return "This action uses an unsupported HTTP method.";
  if (status === 409) return message || "This request conflicts with an existing record.";
  if (status >= 500) return `${message || "Server error."}${requestId ? ` Request ID: ${requestId}` : ""}`;
  if (message) return message;
  return "Network error. Please try again.";
}

async function apiFetch(path, options = {}) {
  let response;
  try {
    const token = await getAuthToken(Boolean(options.forceRefresh));
    response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
  } catch (cause) {
    const error = new Error("Network error. Please try again.");
    error.cause = cause;
    throw error;
  }

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: { code: "NON_JSON_RESPONSE", message: response.ok ? "" : "The server returned HTML instead of JSON." } };
  }
  if (!response.ok) {
    const apiError = typeof data.error === "object" && data.error ? data.error : { code: data.code, message: data.error };
    const error = new Error(friendlyApiError(response.status, apiError.code || data.code, apiError.message || data.error, apiError.requestId));
    error.status = response.status;
    error.code = apiError.code || data.code || "REQUEST_FAILED";
    error.requestId = apiError.requestId || "";
    error.responseBody = text;
    throw error;
  }
  return data;
}

export function getActiveSubscriptions(summary) {
  const now = Date.now();
  return (summary?.subscriptions || []).filter((item) => {
    return item.status === "active" && item.accessEndAt && new Date(item.accessEndAt).getTime() > now;
  });
}

export function getActivePlanIds(summary) {
  return new Set(getActiveSubscriptions(summary).map((item) => item.planId));
}

export function getActiveAccessTags(summary) {
  const tags = new Set();
  getActiveSubscriptions(summary).forEach((item) => {
    (item.accessTags || []).forEach((tag) => tags.add(tag));
  });
  return tags;
}

export function hasResourceAccess(resource, summary) {
  if (!resource.premium) return true;
  const activePlanIds = getActivePlanIds(summary);
  const activeTags = getActiveAccessTags(summary);
  if (Array.isArray(resource.planTags) && resource.planTags.some((planId) => activePlanIds.has(planId))) return true;
  return Boolean(resource.exam && activeTags.has(resource.exam));
}

export async function getAdminMe({ forceRefresh = false, logAccess = false } = {}) {
  return apiFetch(adminApiPath("me", { logAccess: logAccess ? "1" : "" }), { forceRefresh });
}

export async function updateAdminProfile(profile) {
  return adminPost("update_admin_profile", profile);
}

export async function getAdminDashboardOverview(params = {}) {
  const query = new URLSearchParams({ resource: "dashboard" });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  return apiFetch(`/api/admin?${query.toString()}`, { forceRefresh: false });
}
export async function getAdminActivityLogs(limit = 25) {
  return apiFetch(adminApiPath("activity_logs", { limit }), { forceRefresh: true });
}

export async function getAdministrators() {
  return apiFetch(adminApiPath("administrators"), { forceRefresh: true });
}

export async function getAdministrator(uid) {
  return apiFetch(adminApiPath("administrators", { uid }), { forceRefresh: true });
}

export async function searchAdminCandidate(email) {
  return apiFetch(adminApiPath("administrators", { search: "1", email }), { forceRefresh: true });
}

export async function promoteAdministrator(payload) {
  return adminPost("promote_administrator", payload);
}

export async function updateAdministratorRole(uid, payload) {
  return apiFetch(adminApiPath("administrators", { uid }), { method: "PATCH", body: JSON.stringify(payload), forceRefresh: true });
}

export async function suspendAdministrator(uid, payload) {
  return adminPost("suspend_administrator", { uid, ...payload });
}

export async function reactivateAdministrator(uid, payload = {}) {
  return adminPost("reactivate_administrator", { uid, ...payload });
}

export async function revokeAdministrator(uid, payload) {
  return adminPost("revoke_administrator", { uid, ...payload });
}
function adminApiPath(resource, params = {}) {
  const query = new URLSearchParams({ resource });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  return `/api/admin?${query.toString()}`;
}

function adminPost(action, payload = {}, options = {}) {
  return apiFetch("/api/admin", {
    method: "POST",
    body: JSON.stringify({ action, ...payload }),
    forceRefresh: options.forceRefresh ?? true
  });
}
function adminQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export async function getPublicPlans() {
  return apiFetch(studentContentPath("plans"), { forceRefresh: true });
}

export async function getAdminPlans(params = {}) {
  return apiFetch(adminApiPath("plans", params), { forceRefresh: true });
}

export async function getAdminPlan(id) {
  return apiFetch(adminApiPath("plans", { planId: id }), { forceRefresh: true });
}

export async function createAdminPlan(payload) {
  return adminPost("create_plan", payload);
}

export async function updateAdminPlan(id, payload) {
  return adminPost("update_plan", { planId: id, ...payload });
}

export async function duplicateAdminPlan(id) {
  return adminPost("duplicate_plan", { planId: id });
}

export async function setAdminPlanStatus(id, status) {
  const action = status === "active" || status === "published" ? "publish_plan" : status === "unpublished" ? "unpublish_plan" : status === "archived" ? "archive_plan" : status === "trashed" ? "trash_plan" : "restore_plan";
  return adminPost(action, { planId: id });
}

export async function deleteUnusedAdminPlan(id, confirm) {
  return adminPost("delete_unused_plan", { planId: id, confirm });
}

export async function saveAdminPlanVariant(payload) {
  return adminPost(payload?.isNew ? "create_plan_variant" : "update_plan_variant", payload);
}

export async function setAdminPlanVariantStatus(id, status) {
  const action = status === "active" || status === "published" ? "enable_plan_variant" : status === "disabled" ? "disable_plan_variant" : "archive_plan_variant";
  return adminPost(action, { variantId: id });
}

export async function deleteUnusedAdminPlanVariant(id, confirm) {
  return adminPost("delete_unused_plan_variant", { variantId: id, confirm });
}
export async function getAdminUsers(params = {}) {
  return apiFetch(adminApiPath("users", params), { forceRefresh: true });
}

export async function getAdminUser(uid) {
  return apiFetch(adminApiPath("users", { uid }), { forceRefresh: true });
}

export async function updateAdminUser(uid, payload) {
  return apiFetch(adminApiPath("users", { uid }), { method: "PATCH", body: JSON.stringify(payload), forceRefresh: true });
}

export async function updateAdminUserStatus(uid, payload) {
  return adminPost("update_user_status", { uid, ...payload });
}

export async function addAdminEntityNote(entityType, entityId, payload) {
  return adminPost("add_note", { entityType, entityId, ...payload });
}

export async function getAdminSubscriptions(params = {}) {
  return apiFetch(adminApiPath("subscriptions", params), { forceRefresh: true });
}

export async function getAdminSubscription(id) {
  return apiFetch(adminApiPath("subscriptions", { subscriptionId: id }), { forceRefresh: true });
}

export async function grantAdminSubscription(payload) {
  return adminPost("grant_subscription", payload);
}

export async function mutateAdminSubscription(id, action, payload) {
  return adminPost(`${action}_subscription`, { subscriptionId: id, ...payload });
}

export async function getAdminOrders(params = {}) {
  return apiFetch(adminApiPath("orders", params), { forceRefresh: true });
}

export async function getAdminOrder(id) {
  return apiFetch(adminApiPath("orders", { orderId: id }), { forceRefresh: true });
}

export async function getAdminTransactions(params = {}) {
  return apiFetch(adminApiPath("transactions", params), { forceRefresh: true });
}

export async function getAdminTransaction(id) {
  return apiFetch(adminApiPath("transactions", { transactionId: id }), { forceRefresh: true });
}

export async function reconcileAdminTransaction(id) {
  return adminPost("reconcile_transaction", { transactionId: id });
}

export async function exportAdminReport(reportType, params = {}) {
  const token = await getAuthToken(true);
  const response = await fetch(adminApiPath("exports", { type: reportType, ...params }), { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  if (!response.ok) {
    let data = {};
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    const apiError = typeof data.error === "object" && data.error ? data.error : { code: data.code, message: data.error };
    const error = new Error(friendlyApiError(response.status, apiError.code || data.code, apiError.message || data.error, apiError.requestId));
    error.status = response.status;
    error.code = apiError.code || data.code || "REQUEST_FAILED";
    error.requestId = apiError.requestId || "";
    throw error;
  }
  return { filename: response.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] || `${reportType}.csv`, csv: text };
}

export async function getAdminResources(params = {}) {
  return apiFetch(adminApiPath("resources", params), { forceRefresh: true });
}

export async function getAdminResource(id) {
  return apiFetch(adminApiPath("resources", { resourceId: id }), { forceRefresh: true });
}

export async function saveAdminResource(payload) {
  return adminPost("save_resource", payload);
}

export async function duplicateAdminResource(id) {
  return adminPost("duplicate_resource", { resourceId: id });
}

export async function setAdminResourceStatus(id, status, payload = {}) {
  const action = status === "published" ? "publish_resource" : status === "scheduled" ? "schedule_resource" : status === "unpublished" ? "unpublish_resource" : status === "archived" ? "archive_resource" : status === "draft" ? "restore_resource" : `${status}_resource`;
  return adminPost(action, { resourceId: id, ...payload });
}

export async function deleteAdminResource(id, payload = {}) {
  return adminPost("delete_resource", { resourceId: id, ...payload });
}

export async function createResourceUploadSession(file, payload = {}) {
  return adminPost("create_upload_session", { filename: file?.name, mimeType: file?.type, size: file?.size, ...payload });
}

export async function uploadProtectedResourceFile(file, payload = {}, onProgress) {
  if (!file) throw new Error("Choose a file first.");
  const session = await createResourceUploadSession(file, payload);
  const fb = await getFirebase();
  if (!fb?.storageModule || !fb?.storage) throw new Error("Firebase Storage is not configured.");
  const storageRef = fb.storageModule.ref(fb.storage, session.upload.storagePath);
  await new Promise((resolve, reject) => {
    const task = fb.storageModule.uploadBytesResumable(storageRef, file, { contentType: session.upload.contentType || file.type });
    task.on("state_changed", (snapshot) => {
      if (onProgress && snapshot.totalBytes) onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
    }, reject, resolve);
  });
  return { storagePath: session.upload.storagePath, fileName: file.name, mimeType: file.type, fileSize: file.size };
}

export async function getAdminTargets(params = {}) {
  return apiFetch(adminApiPath("targets", params), { forceRefresh: true });
}

export async function getAdminTarget(id) {
  return apiFetch(adminApiPath("targets", { targetId: id }), { forceRefresh: true });
}

export async function saveAdminTarget(payload) {
  return adminPost("save_target", payload);
}

export async function getAdminClasses(params = {}) {
  return apiFetch(adminApiPath("classes", params), { forceRefresh: true });
}

export async function getAdminClass(id) {
  return apiFetch(adminApiPath("classes", { classId: id }), { forceRefresh: true });
}

export async function saveAdminClass(payload) {
  return adminPost("save_class", payload);
}

export async function setAdminTargetStatus(id, status, payload = {}) {
  const action = status === "published" ? "publish_target" : status === "unpublished" ? "unpublish_target" : status === "archived" ? "archive_target" : status === "completed" ? "complete_target" : "restore_target";
  return adminPost(action, { targetId: id, ...payload });
}

export async function deleteAdminTarget(id, payload = {}) {
  return adminPost("delete_target", { targetId: id, ...payload });
}

export async function setAdminClassStatus(id, status, payload = {}) {
  const action = status === "published" ? "publish_class" : status === "unpublished" ? "unpublish_class" : status === "cancelled" ? "cancel_class" : status === "recorded" ? "record_class" : status === "draft" ? "restore_class" : "archive_class";
  return adminPost(action, { classId: id, ...payload });
}

export async function deleteAdminClass(id, payload = {}) {
  return adminPost("delete_class", { classId: id, ...payload });
}

function studentContentPath(resource, params = {}) {
  const query = new URLSearchParams({ resource });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  return `/api/student-content?${query.toString()}`;
}

function studentContentPost(action, payload = {}) {
  return apiFetch("/api/student-content", { method: "POST", body: JSON.stringify({ action, ...payload }), forceRefresh: true });
}

export async function getStudentContentDashboard() {
  return apiFetch(studentContentPath("dashboard"), { forceRefresh: true });
}

export async function getStudentResources(params = {}) {
  return apiFetch(studentContentPath("resources", params), { forceRefresh: true });
}

export async function getStudentResource(id) {
  return apiFetch(studentContentPath("resources", { resourceId: id }), { forceRefresh: true });
}

export async function requestStudentFileAccess(resourceId, download = false) {
  return studentContentPost(download ? "record_download" : "request_file_access", { resourceId });
}

export async function recordStudentResourceView(resourceId) {
  return studentContentPost("record_resource_view", { resourceId });
}

export async function getStudentTargets(params = {}) {
  return apiFetch(studentContentPath("targets", params), { forceRefresh: true });
}

export async function getStudentTarget(id) {
  return apiFetch(studentContentPath("targets", { targetId: id }), { forceRefresh: true });
}

export async function updateStudentTargetProgress(targetId, payload) {
  return studentContentPost("update_target_progress", { targetId, ...payload });
}

export async function getStudentClasses(params = {}) {
  return apiFetch(studentContentPath("classes", params), { forceRefresh: true });
}

export async function joinStudentClass(classId) {
  return studentContentPost("join_class", { classId });
}
export async function createPaymentOrder(variantId, billing) {
  return apiFetch("/api/payments/create-order", {
    method: "POST",
    body: JSON.stringify({ variantId, billing })
  });
}

export async function verifyPayment(payload) {
  return apiFetch("/api/payments/verify", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getOrderStatus(orderId) {
  return apiFetch(`/api/payments/order/${encodeURIComponent(orderId)}`);
}

export async function getPaymentSummary() {
  return apiFetch("/api/users/me/payments");
}
function rememberStudent(user, extra = {}) {
  if (!user?.email) return;
  if (isAdminEmail(user.email)) {
    removeLocalStudent(user.email);
    return;
  }

  const students = storage.get("db_students", {});
  const existing = students[user.email] || {};
  const student = {
    ...existing,
    uid: user.uid || existing.uid || user.email,
    email: user.email,
    name: extra.name || user.displayName || existing.name || user.email.split("@")[0],
    photo: extra.photo || user.photoURL || existing.photo || "",
    phone: extra.phone || existing.phone || "",
    city: extra.city || existing.city || "",
    address: extra.address || existing.address || "",
    targetExam: extra.targetExam || existing.targetExam || "",
    provider: extra.provider || user.providerData?.[0]?.providerId || existing.provider || "password",
    emailVerified: Boolean(user.emailVerified ?? existing.emailVerified),
    activeExams: extra.activeExams || existing.activeExams || [],
    tracking: normalizeTracking(extra.tracking || existing.tracking || getStudyTracking(user.email)),
    lastSeenAt: new Date().toISOString()
  };

  students[user.email] = student;
  storage.set("db_students", students);
  syncStudentToFirestore(student);
}

async function syncStudentToFirestore(student) {
  const fb = await getFirebase();
  if (!fb) return;

  try {
    const id = student.uid;
    await fb.firestoreModule.setDoc(
      fb.firestoreModule.doc(fb.db, "students", id),
      student,
      { merge: true }
    );
  } catch (error) {
    console.error("Unable to sync student profile", error);
  }
}

















