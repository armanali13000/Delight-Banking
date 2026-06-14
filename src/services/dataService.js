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

export async function listenToAuth(callback) {
  const fb = await getFirebase();
  if (!fb) {
    callback(storage.get("db_user", null));
    return () => {};
  }
  return fb.authModule.onAuthStateChanged(fb.auth, callback);
}

export async function signInWithGoogle() {
  const fb = await getFirebase();
  if (!fb) {
    throw new Error("Google login needs Firebase setup first. Add Firebase keys in src/config.js.");
  }

  const provider = new fb.authModule.GoogleAuthProvider();
  const result = await fb.authModule.signInWithPopup(fb.auth, provider);
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
    return user;
  }

  const action = mode === "signup"
    ? fb.authModule.createUserWithEmailAndPassword
    : fb.authModule.signInWithEmailAndPassword;
  const result = await action(fb.auth, email, password);
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

  const snapshot = await fb.firestoreModule.getDocs(fb.firestoreModule.collection(fb.db, "resources"));
  if (snapshot.empty) return seedResources;
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

  const ref = await fb.firestoreModule.addDoc(fb.firestoreModule.collection(fb.db, "resources"), payload);
  return { id: ref.id, ...payload };
}

export async function deleteResource(id) {
  const fb = await getFirebase();
  if (!fb) {
    storage.set("db_resources", storage.get("db_resources", seedResources).filter((item) => item.id !== id));
    return;
  }
  await fb.firestoreModule.deleteDoc(fb.firestoreModule.doc(fb.db, "resources", id));
}

export function getAccessMap() {
  return storage.get("db_access", {});
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
}
