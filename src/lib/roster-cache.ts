import { firestoreDb } from "@/integrations/firebase/config";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
} from "firebase/firestore";

export interface CachedStudent {
  id: string;
  full_name: string;
  index_number: string;
  level: string | number;
  department_id?: string | null;
  department_name?: string | null;
  program?: string | null;
  email?: string | null;
  qr_uuid?: string;
  owner_id?: string;
  [key: string]: any;
}

interface RosterCacheData {
  version: number;
  students: CachedStudent[];
}

function getCacheKey(uid: string): string {
  return `qmark_roster_v1_${uid}`;
}

export function getLocalRosterCache(uid: string): RosterCacheData | null {
  if (typeof window === "undefined" || !uid) return null;
  try {
    const raw = localStorage.getItem(getCacheKey(uid));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLocalRosterCache(uid: string, data: RosterCacheData): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    localStorage.setItem(getCacheKey(uid), JSON.stringify(data));
  } catch (e) {
    console.warn("[roster-cache] LocalStorage write error:", e);
  }
}

/**
 * Loads the lecturer's roster with 1-read version validation.
 * If server version matches local cache and is > 0, returns local cache instantly (1 read total).
 */
export async function getLecturerRoster(
  uid: string,
  options?: { force?: boolean } | boolean,
): Promise<CachedStudent[]> {
  if (!uid) return [];

  const force = typeof options === "boolean" ? options : Boolean(options?.force);
  const cached = getLocalRosterCache(uid);

  try {
    // 1. Read the lecturer's user doc to check roster_version (1 read)
    const userRef = doc(firestoreDb, "users", uid);
    const userSnap = await getDoc(userRef);
    const serverVersion = userSnap.exists()
      ? Number(userSnap.data()?.roster_version) || 0
      : 0;

    // 2. If cached and version matches and is > 0, return cached students immediately
    if (
      cached &&
      !force &&
      cached.version > 0 &&
      cached.version === serverVersion &&
      Array.isArray(cached.students)
    ) {
      return cached.students;
    }

    // 3. Otherwise, fetch this lecturer's students (scoped by owner_id)
    const studQuery = query(
      collection(firestoreDb, "students"),
      where("owner_id", "==", uid),
    );
    const studSnap = await getDocs(studQuery);
    const students: CachedStudent[] = studSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const finalVersion = serverVersion > 0 ? serverVersion : Date.now();

    // If roster_version was 0, set it to Date.now() with setDoc merge
    if (serverVersion === 0) {
      setDoc(userRef, { roster_version: finalVersion }, { merge: true }).catch(() => {});
    }

    setLocalRosterCache(uid, {
      version: finalVersion,
      students,
    });

    return students;
  } catch (err) {
    console.warn("[roster-cache] Failed to fetch fresh roster from Firestore:", err);
    // Graceful offline or quota fallback: return cached roster if available
    if (cached && Array.isArray(cached.students)) {
      return cached.students;
    }
    throw err;
  }
}

/**
 * Updates the lecturer's roster_version on Firestore and removes the local cache
 * whenever students are added, edited, imported, or deleted.
 */
export async function bumpRosterVersion(uid?: string): Promise<number> {
  const targetUid = uid || getAuth().currentUser?.uid || "";
  if (!targetUid) return Date.now();

  const now = Date.now();
  try {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(getCacheKey(targetUid));
      } catch {
        // ignore
      }
    }

    const userRef = doc(firestoreDb, "users", targetUid);
    await setDoc(userRef, { roster_version: now }, { merge: true });
  } catch (err) {
    console.warn("[roster-cache] bumpRosterVersion warning:", err);
  }
  return now;
}

/**
 * Adds or updates student(s) directly in the local cache for immediate UI feedback.
 */
export function addToRosterCache(
  uid: string,
  newOrUpdated: CachedStudent | CachedStudent[],
): void {
  if (!uid) return;
  const cached = getLocalRosterCache(uid);
  if (!cached || !Array.isArray(cached.students)) return;

  const toAdd = Array.isArray(newOrUpdated) ? newOrUpdated : [newOrUpdated];
  const updatedList = [...cached.students];

  for (const item of toAdd) {
    const cleanIdx = String(item.index_number || "").trim().toUpperCase();
    const existingIdx = updatedList.findIndex(
      (s) => s.id === item.id || (cleanIdx && String(s.index_number || "").trim().toUpperCase() === cleanIdx),
    );
    if (existingIdx >= 0) {
      updatedList[existingIdx] = { ...updatedList[existingIdx], ...item };
    } else {
      updatedList.push(item);
    }
  }

  setLocalRosterCache(uid, {
    ...cached,
    students: updatedList,
  });
}

/**
 * Looks up shared QR codes across lecturers via secure server endpoint
 * instead of doing unscoped browser queries across the global students collection.
 */
export async function lookupSharedQrCodes(
  indexes: string[],
): Promise<Record<string, string>> {
  if (!indexes || indexes.length === 0) return {};
  try {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    if (!token) return {};

    const res = await fetch("/api/lecturer/student-qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ indexes }),
    });

    if (!res.ok) return {};
    const data = await res.json();
    return (data && data.qr) || {};
  } catch (err) {
    console.warn("[roster-cache] lookupSharedQrCodes warning:", err);
    return {};
  }
}
