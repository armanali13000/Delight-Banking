import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function required(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`${name} is not configured`);
    error.statusCode = 500;
    error.safeMessage = `Server configuration missing: ${name}`;
    throw error;
  }
  return value;
}

function privateKey() {
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim()) {
    return Buffer.from(
      process.env.FIREBASE_PRIVATE_KEY_BASE64.trim(),
      "base64"
    ).toString("utf8").trim();
  }

  return required("FIREBASE_PRIVATE_KEY")
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "")
    .replace(/\\n/g, "\n");
}

export function getAdminApp() {
  if (getApps().length) return getApp();
  try {
    return initializeApp({
      credential: cert({
        projectId: required("FIREBASE_PROJECT_ID"),
        clientEmail: required("FIREBASE_CLIENT_EMAIL"),
        privateKey: privateKey()
      })
    });
  } catch (cause) {
    const error = new Error("Firebase Admin configuration is invalid.");
    error.statusCode = 500;
    error.safeMessage = "Firebase Admin configuration is invalid. Check FIREBASE_PRIVATE_KEY_BASE64 or FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, and FIREBASE_PROJECT_ID in Vercel.";
    error.cause = cause;
    throw error;
  }
}

export function getDb() {
  return getFirestore(getAdminApp());
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
    return await getAuth(getAdminApp()).verifyIdToken(match[1]);
  } catch (cause) {
    if (cause.safeMessage) throw cause;
    const error = new Error("Invalid login session.");
    error.statusCode = 401;
    error.cause = cause;
    throw error;
  }
}

export const serverTimestamp = FieldValue.serverTimestamp;
export const fieldValue = FieldValue;

