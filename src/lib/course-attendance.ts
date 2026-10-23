import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  arrayUnion,
  arrayRemove,
  deleteField,
} from "firebase/firestore";
import { firestoreDb } from "@/integrations/firebase/config";

export interface CourseAttendanceSummary {
  owner_id: string; // lecturer uid (same as the course)
  course_id: string;
  sessions: Record<string, string>; // { [sessionId]: "YYYY-MM-DD" }
  students: Record<string, string[]>; // { [INDEX_KEY]: string[] } (session IDs attended)
  updated_at: string; // ISO string
}

/**
 * Sanitize student index number into a valid map key:
 * Trimmed, uppercased, with any character that is not A-Z, 0-9, _ or - replaced by "_".
 */
export function toIndexKey(indexNumber: string | null | undefined): string {
  return String(indexNumber ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_");
}

/**
 * Get sorted list of distinct class dates (YYYY-MM-DD) from summary sessions
 */
export function getDistinctClassDays(summary?: CourseAttendanceSummary | null): string[] {
  if (!summary || !summary.sessions) return [];
  const set = new Set<string>();
  for (const date of Object.values(summary.sessions)) {
    if (date && typeof date === "string") {
      set.add(date.slice(0, 10));
    }
  }
  return Array.from(set).sort();
}

/**
 * A student's attended days = the dates of their session IDs that still exist in "sessions".
 * Returns a Set of distinct date strings (YYYY-MM-DD).
 */
export function getStudentAttendedDays(
  summary: CourseAttendanceSummary | null | undefined,
  indexNumber: string | null | undefined,
): Set<string> {
  const attendedDates = new Set<string>();
  if (!summary || !summary.sessions || !summary.students) return attendedDates;
  const key = toIndexKey(indexNumber);
  if (!key) return attendedDates;

  const sessionIds = summary.students[key];
  if (!Array.isArray(sessionIds)) return attendedDates;

  for (const sid of sessionIds) {
    const d = summary.sessions[sid];
    if (d && typeof d === "string") {
      attendedDates.add(d.slice(0, 10));
    }
  }
  return attendedDates;
}

/**
 * When a session is created or opened:
 * set sessions.<sessionId> = its date (YYYY-MM-DD) using setDoc(..., { merge: true }) on course_attendance/<courseId>,
 * including owner_id and course_id.
 */
export async function updateCourseAttendanceSession(
  courseId: string,
  ownerId: string,
  sessionId: string,
  sessionDate: string,
): Promise<void> {
  if (!courseId || !sessionId || !ownerId) return;
  const dateStr = sessionDate.slice(0, 10);
  try {
    const docRef = doc(firestoreDb, "course_attendance", courseId);
    await setDoc(
      docRef,
      {
        owner_id: ownerId,
        course_id: courseId,
        updated_at: new Date().toISOString(),
        sessions: {
          [sessionId]: dateStr,
        },
      },
      { merge: true },
    );
  } catch (err) {
    console.warn(`[CourseAttendance] Warning: failed to register session ${sessionId} for course ${courseId}:`, err);
  }
}

/**
 * When a student is marked present:
 * in the SAME code path, right after the attendance record is saved,
 * update course_attendance/<courseId> with arrayUnion(sessionId) on students.<INDEX_KEY>,
 * and set sessions.<sessionId> = date.
 */
export async function recordStudentAttendanceInSummary(
  courseId: string,
  ownerId: string,
  sessionId: string,
  sessionDate: string,
  indexNumber: string,
): Promise<void> {
  if (!courseId || !sessionId || !indexNumber || !ownerId) return;
  const key = toIndexKey(indexNumber);
  if (!key) return;
  const dateStr = sessionDate.slice(0, 10);
  try {
    const docRef = doc(firestoreDb, "course_attendance", courseId);
    await setDoc(
      docRef,
      {
        owner_id: ownerId,
        course_id: courseId,
        updated_at: new Date().toISOString(),
        sessions: {
          [sessionId]: dateStr,
        },
        students: {
          [key]: arrayUnion(sessionId),
        },
      },
      { merge: true },
    );
  } catch (err) {
    console.warn(`[CourseAttendance] Warning: failed to record student ${key} attendance for course ${courseId}:`, err);
  }
}

/**
 * When a record is deleted: arrayRemove(sessionId) from students.<INDEX_KEY>
 */
export async function removeStudentAttendanceFromSummary(
  courseId: string,
  ownerId: string,
  sessionId: string,
  indexNumber: string,
): Promise<void> {
  if (!courseId || !sessionId || !indexNumber) return;
  const key = toIndexKey(indexNumber);
  if (!key) return;
  try {
    const docRef = doc(firestoreDb, "course_attendance", courseId);
    await setDoc(
      docRef,
      {
        owner_id: ownerId,
        course_id: courseId,
        updated_at: new Date().toISOString(),
        students: {
          [key]: arrayRemove(sessionId),
        },
      },
      { merge: true },
    );
  } catch (err) {
    console.warn(`[CourseAttendance] Warning: failed to remove attendance for student ${key}:`, err);
  }
}

/**
 * When a session is deleted: remove sessions.<sessionId> with deleteField()
 */
export async function deleteSessionFromSummary(
  courseId: string,
  ownerId: string,
  sessionId: string,
): Promise<void> {
  if (!courseId || !sessionId) return;
  try {
    const docRef = doc(firestoreDb, "course_attendance", courseId);
    await setDoc(
      docRef,
      {
        owner_id: ownerId,
        course_id: courseId,
        updated_at: new Date().toISOString(),
        sessions: {
          [sessionId]: deleteField(),
        },
      },
      { merge: true },
    );
  } catch (err) {
    console.warn(`[CourseAttendance] Warning: failed to remove deleted session ${sessionId}:`, err);
  }
}

/**
 * Construct or reconstruct course_attendance/<courseId> from historical sessions and records.
 */
export async function rebuildCourseAttendanceSummary(
  courseId: string,
  ownerId: string,
): Promise<CourseAttendanceSummary> {
  const [sessSnap, recSnap] = await Promise.all([
    getDocs(
      query(
        collection(firestoreDb, "attendance_sessions"),
        where("owner_id", "==", ownerId),
        where("course_id", "==", courseId),
      ),
    ),
    getDocs(
      query(
        collection(firestoreDb, "attendance_records"),
        where("owner_id", "==", ownerId),
        where("course_id", "==", courseId),
      ),
    ),
  ]);

  const sessions: Record<string, string> = {};
  sessSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const dateStr = (
      data.session_date ||
      data.starts_at?.slice(0, 10) ||
      data.created_at?.slice(0, 10) ||
      ""
    ).trim();
    if (dateStr) {
      sessions[d.id] = dateStr;
    }
  });

  const students: Record<string, string[]> = {};
  recSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const sId = data.session_id;
    const rawIdx = data.index_number || "";
    const key = toIndexKey(rawIdx);
    if (!key || !sId) return;

    // If session date is not in sessions map yet, pick from record
    if (!sessions[sId]) {
      const recDate = (data.session_date || data.check_in_at?.slice(0, 10) || "").trim();
      if (recDate) {
        sessions[sId] = recDate;
      }
    }

    if (!students[key]) {
      students[key] = [];
    }
    if (!students[key].includes(sId)) {
      students[key].push(sId);
    }
  });

  const summary: CourseAttendanceSummary = {
    owner_id: ownerId,
    course_id: courseId,
    sessions,
    students,
    updated_at: new Date().toISOString(),
  };

  await setDoc(doc(firestoreDb, "course_attendance", courseId), summary);
  return summary;
}
