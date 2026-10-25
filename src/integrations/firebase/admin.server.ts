if (typeof globalThis !== "undefined") {
  if (typeof (globalThis as any).__dirname === "undefined") {
    (globalThis as any).__dirname =
      typeof process !== "undefined" && process.cwd ? process.cwd() : "/";
  }
  if (typeof (globalThis as any).__filename === "undefined") {
    (globalThis as any).__filename =
      typeof process !== "undefined" && process.cwd ? process.cwd() + "/index.js" : "/index.js";
  }
}

import { getApps, initializeApp, getApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import firebaseConfigData from "../../../firebase-applet-config.json";
import { readServiceAccount } from "./service-account.server";

let adminApp: App | undefined;
let firestoreAdminInstance: Firestore | undefined;

/**
 * Returns or initialises the Firebase Admin App instance.
 * Uses cert(serviceAccount) when service account credentials are available.
 */
export function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length > 0) {
      adminApp = getApp();
    } else {
      const sa = readServiceAccount();
      if (sa) {
        adminApp = initializeApp({
          credential: cert({
            projectId: sa.projectId,
            clientEmail: sa.clientEmail,
            privateKey: sa.privateKey,
          }),
          projectId: sa.projectId,
        });
      } else {
        adminApp = initializeApp({
          projectId: firebaseConfigData.projectId,
        });
      }
    }
  }
  return adminApp;
}

export function getFirestoreAdmin(): Firestore {
  if (!firestoreAdminInstance) {
    const app = getAdminApp();
    const dbId =
      firebaseConfigData.firestoreDatabaseId &&
      firebaseConfigData.firestoreDatabaseId !== "(default)"
        ? firebaseConfigData.firestoreDatabaseId
        : undefined;

    firestoreAdminInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
  return firestoreAdminInstance;
}

export const firestoreAdmin = new Proxy({} as Firestore, {
  get(_target, prop) {
    const admin = getFirestoreAdmin();
    const value = (admin as any)[prop];
    if (typeof value === "function") {
      return value.bind(admin);
    }
    return value;
  },
});

/**
 * Reads "Authorization: Bearer <Firebase ID token>" from an incoming server request,
 * verifies it with Firebase Admin Auth, and returns the lecturer's uid or null.
 */
export async function verifyLecturerRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(token);
    return decoded?.uid || null;
  } catch (err) {
    console.warn("[AdminAuth] verifyLecturerRequest verification failed:", err);
    return null;
  }
}
