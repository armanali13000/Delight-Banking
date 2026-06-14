import { adminEmails, firebaseConfig, seedResources } from "../config.js";

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

function isAdminEmail(email) {
  return Boolean(email && adminEmails.includes(email.toLowerCase()));
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

export async function signInWithGoogle() {
  const fb = await getFirebase();
  if (!fb) {
    throw new Error("Google login needs Firebase setup first. Add Firebase keys in src/config.js.");
  }

  const provider = new fb.authModule.GoogleAuthProvider();
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

export function getAccessMap() {
  return storage.get("db_access", {});
}

export function getStudyTracking(email) {
  if (!email) return getDefaultTracking();
  const allTracking = storage.get("db_tracking", {});
  return normalizeTracking(allTracking[email]);
}

export function saveStudyTracking(email, tracking) {
  if (!email) throw new Error("Login required.");
  const allTracking = storage.get("db_tracking", {});
  allTracking[email] = {
    ...getDefaultTracking(),
    ...(allTracking[email] || {}),
    ...tracking,
    updatedAt: new Date().toISOString()
  };
  storage.set("db_tracking", allTracking);
  rememberStudent({ email }, { tracking: allTracking[email] });
  return allTracking[email];
}

function getDefaultTracking() {
  return {
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

  return {
    ...getDefaultTracking(),
    ...tracking,
    weeklyHours: Array.isArray(tracking.weeklyHours) && tracking.weeklyHours.length === 7
      ? tracking.weeklyHours.map((hours) => Number(hours || 0))
      : getDefaultTracking().weeklyHours,
    subjects: {
      ...getDefaultTracking().subjects,
      ...(tracking.subjects || {})
    }
  };
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
  const access = getAccessMap();
  const tracking = storage.get("db_tracking", {});

  return Object.values(students).filter((student) => !isAdminEmail(student.email)).map((student) => {
    const profile = profiles[student.email] || {};
    return {
      ...student,
      ...profile,
      activeExams: access[student.email] || [],
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

export function hasExamAccess(user, exam) {
  if (!user) return false;
  return Boolean(getAccessMap()[user.email]?.includes(exam));
}

export function activateAccess(user, exam) {
  if (!user) throw new Error("Login required.");
  const access = getAccessMap();
  const active = new Set(access[user.email] || []);
  active.add(exam);
  access[user.email] = [...active];
  storage.set("db_access", access);
  rememberStudent(user, { activeExams: access[user.email] });
}

function rememberStudent(user, extra = {}) {
  if (!user?.email) return;
  if (isAdminEmail(user.email)) {
    removeLocalStudent(user.email);
    return;
  }

  const students = storage.get("db_students", {});
  const existing = students[user.email] || {};
  const access = getAccessMap();
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
    activeExams: extra.activeExams || access[user.email] || existing.activeExams || [],
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
    const id = encodeURIComponent(student.email);
    await fb.firestoreModule.setDoc(
      fb.firestoreModule.doc(fb.db, "students", id),
      student,
      { merge: true }
    );
  } catch (error) {
    console.error("Unable to sync student profile", error);
  }
}
