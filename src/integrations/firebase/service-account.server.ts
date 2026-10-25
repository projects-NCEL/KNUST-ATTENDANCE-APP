import { cert } from "firebase-admin/app";
import firebaseConfig from "../../../firebase-applet-config.json";

export interface ServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

let warnedNoServiceAccount = false;
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let cachedCredential: ReturnType<typeof cert> | null = null;

/**
 * Reads service account credentials from environment variables.
 * Checks FIREBASE_SERVICE_ACCOUNT (full JSON string),
 * falling back to FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 */
export function readServiceAccount(): ServiceAccountCredentials | null {
  const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr.trim());
      const projectId = parsed.project_id || firebaseConfig.projectId;
      const clientEmail = parsed.client_email;
      let privateKey = parsed.private_key;
      if (typeof privateKey === "string") {
        privateKey = privateKey.replace(/\\n/g, "\n");
      }
      if (clientEmail && privateKey) {
        return { projectId, clientEmail, privateKey };
      }
    } catch (err) {
      console.error("[ServiceAccount] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", err);
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;

  if (clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

/**
 * Returns a cached OAuth2 access token for the service account,
 * refreshing it 60 seconds before expiration.
 * Warns once and returns null if no service account is configured.
 */
export async function getServiceAccountToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const sa = readServiceAccount();
  if (!sa) {
    if (!warnedNoServiceAccount) {
      console.warn(
        "[ServiceAccount] Notice: No service account configured in environment variables (FIREBASE_SERVICE_ACCOUNT). Running without service account token.",
      );
      warnedNoServiceAccount = true;
    }
    return null;
  }

  try {
    if (!cachedCredential) {
      cachedCredential = cert({
        projectId: sa.projectId,
        clientEmail: sa.clientEmail,
        privateKey: sa.privateKey,
      });
    }

    const tokenResult = await cachedCredential.getAccessToken();
    if (tokenResult?.access_token) {
      cachedToken = tokenResult.access_token;
      // expires_in is in seconds
      const expiresInMs = (tokenResult.expires_in || 3600) * 1000;
      tokenExpiresAt = Date.now() + expiresInMs;
      return cachedToken;
    }
  } catch (err) {
    console.error("[ServiceAccount] Failed to retrieve service account access token:", err);
  }

  return null;
}
