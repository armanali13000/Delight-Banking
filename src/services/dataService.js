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
    import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js")
  ]).then(([appModule, authModule, firestoreModule]) => {
    const app = appModule.initializeApp(firebaseConfig);
    return {
      appModule,
      authModule,
      firestoreModule,
      app,
      auth: authModule.getAuth(app),
      db: firestoreModule.getFirestore(app)
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

function friendlyApiError(status, code, message) {
  if (code === "RECENT_LOGIN_REQUIRED") return "Recent authentication is required.";
  if (code === "ADMIN_ALREADY_ACTIVE") return "This user is already an administrator.";
  if (code === "TARGET_EMAIL_UNVERIFIED") return "This email must be verified first.";
  if (code === "TARGET_ACCOUNT_DISABLED") return "This account is disabled.";
  if (status === 401) return "Your admin session has expired. Please sign in again.";
  if (status === 403) return message || "You do not have permission to manage administrators.";
  if (status === 404) return message || "The requested admin account or API route was not found.";
  if (status === 405) return "Administrator API method is not configured correctly.";
  if (status === 409) return message || "This user is already an administrator.";
  if (status >= 500) return message || "Administrator access could not be granted. Check the server logs.";
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
    data = { error: response.ok ? "" : "Request failed." };
  }
  if (!response.ok) {
    const error = new Error(friendlyApiError(response.status, data.code, data.error));
    error.status = response.status;
    error.code = data.code || "REQUEST_FAILED";
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
  const suffix = logAccess ? "?logAccess=1" : "";
  return apiFetch(`/api/admin/me${suffix}`, { forceRefresh });
}

export async function updateAdminProfile(profile) {
  return apiFetch("/api/admin/profile", {
    method: "PATCH",
    body: JSON.stringify(profile),
    forceRefresh: true
  });
}

export async function getAdminActivityLogs(limit = 25) {
  return apiFetch(`/api/admin/activity-logs?limit=${encodeURIComponent(limit)}`, { forceRefresh: true });
}

export async function getAdministrators() {
  return apiFetch("/api/admin/administrators", { forceRefresh: true });
}

export async function getAdministrator(uid) {
  return apiFetch(`/api/admin/administrators/${encodeURIComponent(uid)}`, { forceRefresh: true });
}

export async function searchAdminCandidate(email) {
  return apiFetch(`/api/admin/users/search?email=${encodeURIComponent(email)}`, { forceRefresh: true });
}

export async function promoteAdministrator(payload) {
  return apiFetch("/api/admin/administrators/promote", {
    method: "POST",
    body: JSON.stringify(payload),
    forceRefresh: true
  });
}

export async function updateAdministratorRole(uid, payload) {
  return apiFetch(`/api/admin/administrators/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    forceRefresh: true
  });
}

export async function suspendAdministrator(uid, payload) {
  return apiFetch(`/api/admin/administrators/${encodeURIComponent(uid)}/suspend`, {
    method: "POST",
    body: JSON.stringify(payload),
    forceRefresh: true
  });
}

export async function reactivateAdministrator(uid, payload = {}) {
  return apiFetch(`/api/admin/administrators/${encodeURIComponent(uid)}/reactivate`, {
    method: "POST",
    body: JSON.stringify(payload),
    forceRefresh: true
  });
}

export async function revokeAdministrator(uid, payload) {
  return apiFetch(`/api/admin/administrators/${encodeURIComponent(uid)}/revoke`, {
    method: "POST",
    body: JSON.stringify(payload),
    forceRefresh: true
  });
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






