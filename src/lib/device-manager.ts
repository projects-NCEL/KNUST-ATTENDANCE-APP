import { firestoreDb } from "@/integrations/firebase/config";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

export const MAX_DEVICES_PER_ACCOUNT = 6;

export interface UserDevice {
  id: string; // `${userId}_${deviceId}`
  user_id: string;
  device_id: string;
  device_name: string;
  device_type: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
  last_active: string;
  created_at: string;
  status: "active" | "revoked";
}

/**
 * Computes a stable hardware device fingerprint representing the physical machine
 * across different browsers on the same device.
 */
function getHardwareFingerprint(): string {
  if (typeof window === "undefined") return "server-hardware";

  const nav = window.navigator as any;
  const screen = window.screen;

  // Extract core hardware & platform identifiers that remain invariant across browsers on same device
  const os = getNormalizedOS();
  const screenResolution = `${Math.max(screen.width, screen.height)}x${Math.min(screen.width, screen.height)}`;
  const colorDepth = screen.colorDepth || 24;
  const hardwareConcurrency = nav.hardwareConcurrency || 4;
  // Maximum touch points (hardware attribute of device display)
  const maxTouchPoints = nav.maxTouchPoints || 0;
  
  // Platform / architecture hint
  const platform = nav.platform || "";
  
  // Audio context / WebGL renderer clues if available
  let gpuVendorRenderer = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gpuVendorRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
      }
    }
  } catch {
    // Ignore canvas/webgl restrictions
  }

  // Combine invariant hardware features into a clean raw string
  const rawParts = [
    os,
    screenResolution,
    colorDepth,
    hardwareConcurrency,
    maxTouchPoints,
    platform,
    gpuVendorRenderer.trim(),
  ].join("###");

  // Hash string into a deterministic compact hex identifier
  let hash = 0;
  for (let i = 0; i < rawParts.length; i++) {
    const char = rawParts.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }

  const positiveHash = Math.abs(hash).toString(16).padStart(8, "0");
  const deviceType = getDeviceCategory();
  return `dev_${deviceType}_${positiveHash}`;
}

function getNormalizedOS(): string {
  if (typeof window === "undefined") return "Server";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Linux/i.test(ua)) return "Linux";
  return "UnknownOS";
}

function getDeviceCategory(): "desktop" | "mobile" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Retrieves or computes a persistent hardware device ID for this physical device.
 * Even if a user opens Chrome, Edge, Safari, or Firefox on the same laptop or phone,
 * it resolves to the same physical device ID so the limit applies strictly to devices, not browsers.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server-instance";
  const KEY = "qroll_hardware_device_id";

  // Check stored ID on this browser
  const stored = localStorage.getItem(KEY);
  if (stored && stored.startsWith("dev_")) {
    return stored;
  }

  // Compute deterministic hardware fingerprint
  const hwId = getHardwareFingerprint();
  try {
    localStorage.setItem(KEY, hwId);
  } catch {
    // Ignore storage quota
  }
  return hwId;
}

/**
 * Analyzes browser navigator to identify OS, browser, and physical device.
 */
export function getDeviceInfo(): {
  name: string;
  type: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
} {
  if (typeof window === "undefined") {
    return { name: "Server", type: "desktop", browser: "Unknown", os: "Unknown" };
  }

  const ua = navigator.userAgent;
  const os = getNormalizedOS();

  // Browser detection
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";

  const type = getDeviceCategory();

  // Clean, device-centric naming: e.g. "Windows PC (Chrome)", "MacBook / iMac (Safari)", "Android Device (Chrome)"
  let deviceDescriptor = "Computer";
  if (type === "mobile") {
    deviceDescriptor = os === "iOS" ? "iPhone" : `${os} Phone`;
  } else if (type === "tablet") {
    deviceDescriptor = os === "iOS" ? "iPad" : `${os} Tablet`;
  } else {
    deviceDescriptor = os === "macOS" ? "Mac" : `${os} PC`;
  }

  const name = `${deviceDescriptor} (${browser})`;
  return { name, type, browser, os };
}

/**
 * Checks and registers this device for the authenticated user.
 * Enforces the MAX_DEVICES_PER_ACCOUNT (4) limit.
 */
export async function registerOrVerifyDevice(userId: string): Promise<{
  allowed: boolean;
  limitReached: boolean;
  currentDeviceId: string;
  activeDevices: UserDevice[];
}> {
  const currentDeviceId = getDeviceId();
  const info = getDeviceInfo();
  const docId = `${userId}_${currentDeviceId}`;

  try {
    const q = query(
      collection(firestoreDb, "user_devices"),
      where("user_id", "==", userId),
      where("status", "==", "active"),
    );
    const snap = await getDocs(q);
    const activeDevices: UserDevice[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    // Check if this device is already in active list
    const existing = activeDevices.find((d) => d.device_id === currentDeviceId);

    if (existing) {
      // Update last active
      const now = new Date().toISOString();
      await updateDoc(doc(firestoreDb, "user_devices", docId), {
        last_active: now,
        device_name: info.name,
      }).catch(() => {});
      return { allowed: true, limitReached: false, currentDeviceId, activeDevices };
    }

    // New device: check if account is already at max capacity (4)
    if (activeDevices.length >= MAX_DEVICES_PER_ACCOUNT) {
      return { allowed: false, limitReached: true, currentDeviceId, activeDevices };
    }

    // Capacity available: register this device
    const now = new Date().toISOString();
    const newDevice: UserDevice = {
      id: docId,
      user_id: userId,
      device_id: currentDeviceId,
      device_name: info.name,
      device_type: info.type,
      browser: info.browser,
      os: info.os,
      last_active: now,
      created_at: now,
      status: "active",
    };

    await setDoc(doc(firestoreDb, "user_devices", docId), newDevice);
    activeDevices.push(newDevice);

    return { allowed: true, limitReached: false, currentDeviceId, activeDevices };
  } catch (err) {
    console.error("Error registering device:", err);
    // Allow gracefully so network blips don't block user
    return { allowed: true, limitReached: false, currentDeviceId, activeDevices: [] };
  }
}

/**
 * Fetch all registered devices for a user.
 */
export async function getUserDevices(userId: string): Promise<UserDevice[]> {
  const q = query(collection(firestoreDb, "user_devices"), where("user_id", "==", userId));
  const snap = await getDocs(q);
  const list: UserDevice[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  return list
    .filter((d) => d.status === "active")
    .sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime());
}

/**
 * Revokes access for a specific device.
 */
export async function revokeDevice(deviceDocId: string): Promise<void> {
  const ref = doc(firestoreDb, "user_devices", deviceDocId);
  await updateDoc(ref, { status: "revoked" }).catch(async () => {
    await deleteDoc(ref);
  });
}

/**
 * Revokes all other devices for this user except the current device.
 */
export async function revokeOtherDevices(userId: string, keepDeviceId: string): Promise<void> {
  const q = query(
    collection(firestoreDb, "user_devices"),
    where("user_id", "==", userId),
    where("status", "==", "active"),
  );
  const snap = await getDocs(q);
  const promises = snap.docs
    .filter((d) => (d.data() as any).device_id !== keepDeviceId)
    .map((d) => updateDoc(d.ref, { status: "revoked" }));
  await Promise.all(promises);
}

/**
 * Listens in real-time to detect if the current device has been revoked from another session.
 */
export function listenToDeviceStatus(
  userId: string,
  deviceId: string,
  onRevoked: () => void,
): () => void {
  const docId = `${userId}_${deviceId}`;
  const ref = doc(firestoreDb, "user_devices", docId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.status === "revoked") {
          onRevoked();
        }
      }
    },
    (err) => {
      // Gracefully handle listener errors (network glitches or transitions)
      console.warn("Device status listener notice:", err.message);
    },
  );
}
