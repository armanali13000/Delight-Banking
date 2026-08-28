import admin from "firebase-admin";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getAdminApp() {
  if (admin.apps.length) return admin.app();
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: required("FIREBASE_PROJECT_ID"),
      clientEmail: required("FIREBASE_CLIENT_EMAIL"),
      privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n")
    })
  });
}

export function getDb() {
  return getAdminApp().firestore();
}

export async function requireUser(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    const error = new Error("Login required.");
    error.statusCode = 401;
    throw error;
  }
  try {
    return await getAdminApp().auth().verifyIdToken(match[1]);
  } catch {
    const error = new Error("Invalid login session.");
    error.statusCode = 401;
    throw error;
  }
}

export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
export const fieldValue = admin.firestore.FieldValue;
