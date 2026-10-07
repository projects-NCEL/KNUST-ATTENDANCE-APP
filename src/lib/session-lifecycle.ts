/**
 * Centralized Session Lifecycle & Midnight Expiry Engine
 * 
 * Enforces automatic closure of attendance sessions at 12:00 AM (midnight)
 * according to the local timezone of the device/country where the app is used (e.g., Ghana GMT/UTC).
 * When reopening or starting a new class day for a course, automatically provisions
 * the next sequential session (e.g., Session 1 -> Session 2) with a fresh attendance sheet.
 */

export interface SessionRecordLike {
  id?: string;
  status?: string | null;
  starts_at?: string | null;
  created_at?: string | null;
  auto_closes_at?: string | null;
  is_active?: boolean | null;
  session_number?: number | string | null;
  title?: string | null;
  course_id?: string | null;
}

/**
 * Returns the detected user/device local timezone (e.g., "Africa/Accra" in Ghana).
 */
export function getDetectedLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Accra";
  } catch {
    return "Africa/Accra";
  }
}

/**
 * Returns the exact Date when the session closes at 12:00:00 AM midnight
 * in the local timezone of the device/country where the app is used.
 */
export function getSessionLocalMidnight(
  startsAtOrSession?: string | SessionRecordLike | null,
): Date | null {
  if (!startsAtOrSession) return null;

  if (typeof startsAtOrSession === "object") {
    if (startsAtOrSession.auto_closes_at) {
      const explicit = new Date(startsAtOrSession.auto_closes_at);
      if (!isNaN(explicit.getTime())) return explicit;
    }
    const iso = startsAtOrSession.starts_at || startsAtOrSession.created_at;
    if (!iso) return null;
    return getSessionLocalMidnight(iso);
  }

  const startDate = new Date(startsAtOrSession);
  if (isNaN(startDate.getTime())) return null;

  // 12:00:00 AM midnight of the calendar day following the start date in local device/country time
  return new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate() + 1,
    0,
    0,
    0,
    0,
  );
}

/**
 * Checks whether 12:00 midnight (local time) has passed since the session started.
 * Evaluates against explicit auto_closes_at or the next 12:00:00 AM midnight.
 */
export function hasPassedLocalMidnight(
  startsAtOrSession?: string | SessionRecordLike | null,
): boolean {
  if (!startsAtOrSession) return false;

  if (typeof startsAtOrSession === "object") {
    if (startsAtOrSession.auto_closes_at) {
      const closeTime = new Date(startsAtOrSession.auto_closes_at).getTime();
      if (!isNaN(closeTime)) {
        return Date.now() >= closeTime;
      }
    }
    const iso = startsAtOrSession.starts_at || startsAtOrSession.created_at;
    if (!iso) return false;
    return hasPassedLocalMidnight(iso);
  }

  const nextMidnight = getSessionLocalMidnight(startsAtOrSession);
  if (!nextMidnight) return false;

  return Date.now() >= nextMidnight.getTime();
}

/**
 * Formats the midnight closing time for display (e.g. "Tonight at 12:00 AM" or "Closed at 12:00 AM midnight")
 */
export function formatMidnightClosureLabel(
  startsAtOrSession?: string | SessionRecordLike | null,
): string {
  if (!startsAtOrSession) return "Closes at midnight";
  const passed = hasPassedLocalMidnight(startsAtOrSession);
  if (passed) {
    return "Closed at 12:00 AM midnight";
  }
  return "Closes tonight at 12:00 AM midnight";
}

/**
 * Checks if a session is currently active and has not passed midnight.
 */
export function isSessionOpenAndValid(session?: SessionRecordLike | null): boolean {
  if (!session) return false;
  if (session.status === "CLOSED" || session.is_active === false) return false;
  if (hasPassedLocalMidnight(session)) return false;
  return session.status === "OPEN" || session.is_active === true;
}

/**
 * Computes the next session number for a course.
 */
export function computeNextSessionNumber(
  existingSessions: Array<{ session_number?: number | string | null; title?: string | null }>,
): number {
  let highest = 0;
  for (const s of existingSessions) {
    if (typeof s.session_number === "number" && s.session_number > highest) {
      highest = s.session_number;
    } else if (s.session_number && !isNaN(Number(s.session_number))) {
      highest = Math.max(highest, Number(s.session_number));
    } else if (s.title) {
      const match = s.title.match(/Session\s+(\d+)/i);
      if (match && match[1]) {
        highest = Math.max(highest, parseInt(match[1], 10));
      }
    }
  }
  return highest > 0 ? highest + 1 : existingSessions.length + 1;
}
