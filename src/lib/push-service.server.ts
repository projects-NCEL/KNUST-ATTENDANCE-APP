// Centralized Web Push Notification Engine
// Kwame Nkrumah University of Science and Technology (KNUST)
import webpush from "web-push";
import { createHash } from "crypto";
import {
  getDocRest,
  setDocRest,
  deleteDocRest,
  queryCollectionRest,
} from "@/integrations/firebase/firestore-rest";

// VAPID Credentials configuration (Production keypair with fallback)
export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  "BIJP2aHS8Vo_Ad4oZe17o13KZzLldZMjd8IuAchiMHtcpoinWpJTy813NUn-H3vyibfA7r1AyPsBikL0LZKJp1s";

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || "Cq_DUkdtJW0sstYIzXBWhSzy5plN8E5OeWkqS1JlYQY";

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:project1232026@gmail.com";

// Initialize Web Push with VAPID credentials
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.error("[WebPush] Initialization error:", err);
}

export type NotificationType =
  | "ATTENDANCE"
  | "ANNOUNCEMENT"
  | "ASSIGNMENT"
  | "DEADLINE"
  | "SYSTEM"
  | "TEST";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  entityId?: string;
  entityType?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  timestamp?: number;
  actions?: Array<{ action: string; title: string }>;
}

export interface StoredPushSubscription {
  id: string;
  userId: string;
  userRole: "student" | "lecturer" | "admin";
  studentId?: string | null;
  indexNumber?: string | null;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  platform: string;
  browser: string;
  userAgent: string;
  isStandalone: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  failureCount?: number;
}

/** Deterministic document ID from push endpoint to prevent device duplicates */
export function getSubscriptionDocId(endpoint: string): string {
  const hash = createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
  return `sub_${hash}`;
}

/** Save or update a device's push subscription in Firestore */
export async function savePushSubscription(
  userId: string,
  userRole: "student" | "lecturer" | "admin",
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  deviceInfo: {
    platform?: string;
    browser?: string;
    userAgent?: string;
    isStandalone?: boolean;
    studentId?: string;
    indexNumber?: string;
  } = {},
): Promise<StoredPushSubscription> {
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new Error("Invalid push subscription format");
  }

  const docId = getSubscriptionDocId(subscription.endpoint);
  const now = new Date().toISOString();
  const cleanUserId = String(userId).trim();

  // Check if existing record exists
  const existing = await getDocRest("push_subscriptions", docId);

  const subDoc: StoredPushSubscription = {
    id: docId,
    userId: cleanUserId,
    userRole,
    studentId: deviceInfo.studentId || existing?.studentId || null,
    indexNumber:
      deviceInfo.indexNumber ||
      (userRole === "student" ? cleanUserId : null) ||
      existing?.indexNumber ||
      null,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    platform: deviceInfo.platform || "unknown",
    browser: deviceInfo.browser || "unknown",
    userAgent: deviceInfo.userAgent || "",
    isStandalone: Boolean(deviceInfo.isStandalone),
    isActive: true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    failureCount: 0,
    lastSuccessAt: existing?.lastSuccessAt || null,
    lastFailureAt: null,
  };

  // Save new subscription
  await setDocRest("push_subscriptions", docId, subDoc, true);

  // Deactivate any older subscriptions for this user on the same platform with different endpoints
  try {
    const userSubs = await queryCollectionRest("push_subscriptions", {
      where: [
        { field: "userId", op: "EQUAL", value: cleanUserId },
        { field: "isActive", op: "EQUAL", value: true },
      ],
    });
    for (const s of userSubs) {
      if (s.id !== docId && s.platform === subDoc.platform && s.endpoint !== subDoc.endpoint) {
        setDocRest("push_subscriptions", s.id, {
          isActive: false,
          updatedAt: now,
          failureReason: "superseded_by_new_subscription",
        }).catch(() => {});
      }
    }
  } catch {
    // non-blocking cleanup
  }

  console.log(
    `[WebPush] Subscription saved for ${userRole} ${cleanUserId} on ${subDoc.platform}/${subDoc.browser}`,
  );
  return subDoc;
}

/** Deactivate or remove a push subscription */
export async function removePushSubscription(endpoint: string, userId?: string): Promise<boolean> {
  if (!endpoint) return false;
  const docId = getSubscriptionDocId(endpoint);
  try {
    const existing = await getDocRest("push_subscriptions", docId);
    if (!existing) return true;

    // Verify ownership if userId is provided
    if (userId && existing.userId !== String(userId).trim()) {
      return false;
    }

    await setDocRest("push_subscriptions", docId, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
    console.log(`[WebPush] Subscription deactivated: ${docId}`);
    return true;
  } catch (err) {
    console.error("[WebPush] Failed to deactivate subscription:", err);
    return false;
  }
}

// In-memory dispatch cache to guarantee no device receives identical notifications within a 15s window
const recentDispatches = new Map<string, number>();

function cleanRecentDispatches() {
  const now = Date.now();
  for (const [key, timestamp] of recentDispatches.entries()) {
    if (now - timestamp > 30000) {
      recentDispatches.delete(key);
    }
  }
}

/** Low-level sender to a single subscription document with strict deduplication */
async function sendToSubscriptionRecord(
  sub: StoredPushSubscription,
  payload: NotificationPayload,
): Promise<{ success: boolean; expired?: boolean; error?: string; skippedDuplicate?: boolean }> {
  cleanRecentDispatches();

  // Deduplication key: combination of endpoint and notification title + entityId
  const cleanEntityId = payload.entityId || (payload.title ? payload.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 32) : "notice");
  const dedupKey = `${sub.endpoint}::${payload.type}::${cleanEntityId}::${payload.title}`;
  const lastSent = recentDispatches.get(dedupKey);
  const now = Date.now();

  if (lastSent && now - lastSent < 1200) {
    console.log(`[WebPush] Dropped duplicate push dispatch to ${sub.id} (within 1.2s debounce window)`);
    return { success: true, skippedDuplicate: true };
  }

  recentDispatches.set(dedupKey, now);

  const deterministicTag = payload.tag || `${payload.type || "qmark"}_${cleanEntityId}_${now}`;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/qmark_icon_standalone.png",
    badge: payload.badge || "/qmark_icon_standalone.png",
    url: payload.url || "/",
    entityId: payload.entityId,
    entityType: payload.entityType,
    type: payload.type,
    tag: deterministicTag,
    timestamp: payload.timestamp || Date.now(),
    actions: payload.actions,
  });

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, pushPayload, {
      TTL: 86400, // 24 hours
      urgency: payload.type === "ATTENDANCE" ? "high" : "normal",
    });

    // Record success
    setDocRest("push_subscriptions", sub.id, {
      lastSuccessAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      failureCount: 0,
    }).catch(() => {});

    return { success: true };
  } catch (err: any) {
    const statusCode = err?.statusCode;

    // HTTP 404 Not Found or 410 Gone means the subscription is permanently expired/unregistered
    if (statusCode === 404 || statusCode === 410) {
      console.warn(`[WebPush] Subscription expired (${statusCode}) for ${sub.id}. Deactivating.`);
      setDocRest("push_subscriptions", sub.id, {
        isActive: false,
        lastFailureAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        failureReason: `expired_${statusCode}`,
      }).catch(() => {});
      return { success: false, expired: true, error: `expired_${statusCode}` };
    }

    console.error(`[WebPush] Delivery error for ${sub.id} (HTTP ${statusCode}):`, err?.message || err);
    setDocRest("push_subscriptions", sub.id, {
      lastFailureAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      failureCount: (sub.failureCount || 0) + 1,
    }).catch(() => {});

    return { success: false, error: err?.message || "Delivery failed" };
  }
}

/** Check user preferences before sending */
export async function isNotificationAllowed(
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  try {
    const pref = await getDocRest("notification_preferences", userId);
    if (!pref) return true; // Default to enabled

    if (pref.pushEnabled === false) return false;

    if (type === "ATTENDANCE" && pref.attendance === false) return false;
    if (type === "ANNOUNCEMENT" && pref.announcements === false) return false;
    if (type === "ASSIGNMENT" && pref.assignments === false) return false;
    if (type === "DEADLINE" && pref.deadlines === false) return false;
    if (type === "SYSTEM" && pref.system === false) return false;

    return true;
  } catch {
    return true;
  }
}

/** Persist In-App Notification history */
export async function saveInAppNotification(
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await setDocRest("in_app_notifications", notifId, {
      id: notifId,
      userId: String(userId).trim(),
      type: payload.type,
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      entityId: payload.entityId || null,
      entityType: payload.entityType || null,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[WebPush] Failed to save in-app notification:", err);
  }
}

/**
 * Send a notification to all active devices of a single user
 */
export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload,
): Promise<{ targetDevices: number; successful: number; failed: number }> {
  const cleanId = String(userId).trim();
  if (!cleanId) return { targetDevices: 0, successful: 0, failed: 0 };

  // Always store in-app notification history
  await saveInAppNotification(cleanId, payload);

  // Check if push is allowed for this category
  const allowed = await isNotificationAllowed(cleanId, payload.type);
  if (!allowed) {
    console.log(`[WebPush] Push blocked by user preference for ${cleanId} (${payload.type})`);
    return { targetDevices: 0, successful: 0, failed: 0 };
  }

  // Query all active devices for this user (by userId, indexNumber, or studentId)
  let subscriptions = await queryCollectionRest("push_subscriptions", {
    where: [
      { field: "userId", op: "EQUAL", value: cleanId },
      { field: "isActive", op: "EQUAL", value: true },
    ],
  });

  if (subscriptions.length === 0) {
    const byIndex = await queryCollectionRest("push_subscriptions", {
      where: [
        { field: "indexNumber", op: "EQUAL", value: cleanId },
        { field: "isActive", op: "EQUAL", value: true },
      ],
    });
    if (byIndex.length > 0) {
      subscriptions = byIndex;
    } else {
      const byStudentId = await queryCollectionRest("push_subscriptions", {
        where: [
          { field: "studentId", op: "EQUAL", value: cleanId },
          { field: "isActive", op: "EQUAL", value: true },
        ],
      });
      if (byStudentId.length > 0) {
        subscriptions = byStudentId;
      }
    }
  }

  if (subscriptions.length === 0) {
    return { targetDevices: 0, successful: 0, failed: 0 };
  }

  // Deduplicate subscriptions by endpoint and keep only the latest active one per platform/endpoint
  const dedupedSubsMap = new Map<string, StoredPushSubscription>();
  for (const s of subscriptions) {
    if (!s.endpoint) continue;
    const existing = dedupedSubsMap.get(s.endpoint);
    if (!existing || (s.updatedAt || "") > (existing.updatedAt || "")) {
      dedupedSubsMap.set(s.endpoint, s as StoredPushSubscription);
    }
  }

  // If a user has multiple active subscriptions on the same mobile platform (e.g. iOS), keep only the newest one
  const platformGroup = new Map<string, StoredPushSubscription>();
  for (const sub of Array.from(dedupedSubsMap.values())) {
    const key = sub.platform || "unknown";
    const prev = platformGroup.get(key);
    if (!prev || (sub.updatedAt || "") > (prev.updatedAt || "")) {
      if (prev && prev.id !== sub.id) {
        // Deactivate older duplicate subscription for this device
        setDocRest("push_subscriptions", prev.id, {
          isActive: false,
          updatedAt: new Date().toISOString(),
          failureReason: "superseded_by_newer_device_sub",
        }).catch(() => {});
      }
      platformGroup.set(key, sub);
    } else if (prev && prev.id !== sub.id) {
      setDocRest("push_subscriptions", sub.id, {
        isActive: false,
        updatedAt: new Date().toISOString(),
        failureReason: "superseded_by_newer_device_sub",
      }).catch(() => {});
    }
  }

  const finalSubs = Array.from(platformGroup.values());
  let successful = 0;
  let failed = 0;

  for (const sub of finalSubs) {
    const res = await sendToSubscriptionRecord(sub, payload);
    if (res.success) {
      successful++;
    } else {
      failed++;
    }
  }

  console.log(
    `[WebPush] Sent "${payload.title}" to user ${cleanId} (${successful}/${finalSubs.length} device(s) delivered)`,
  );

  return { targetDevices: finalSubs.length, successful, failed };
}

/**
 * Send notification to a list of users concurrently with instant subscription lookup
 */
export async function sendNotificationToUsers(
  userIds: string[],
  payload: NotificationPayload,
): Promise<{ totalUsers: number; totalDelivered: number }> {
  const targetIdSet = new Set(userIds.filter(Boolean).map((id) => String(id).trim()));
  if (targetIdSet.size === 0) return { totalUsers: 0, totalDelivered: 0 };

  console.log(`[WebPush] Broadcasting "${payload.title}" to ${targetIdSet.size} user ID(s)`);

  // Persist In-App notifications for all target users
  const uniqueRecipientList = Array.from(targetIdSet);
  Promise.all(
    uniqueRecipientList.map((uid) => saveInAppNotification(uid, payload).catch(() => {})),
  ).catch(() => {});

  // Fetch all active subscriptions in ONE query instead of looping over every user
  let activeSubs: any[] = [];
  try {
    activeSubs = await queryCollectionRest("push_subscriptions", {
      where: [{ field: "isActive", op: "EQUAL", value: true }],
    });
  } catch (err) {
    console.warn("[WebPush] Failed to query active push subscriptions:", err);
  }

  // Filter subscriptions matching any target userId, indexNumber, or studentId
  const matchingSubs = activeSubs.filter((sub: any) => {
    const uid = String(sub.userId || "").trim();
    const idx = String(sub.indexNumber || "").trim();
    const sid = String(sub.studentId || "").trim();
    return (
      (uid && targetIdSet.has(uid)) ||
      (idx && targetIdSet.has(idx)) ||
      (sid && targetIdSet.has(sid))
    );
  });

  // Deduplicate by endpoint to prevent double alerts
  const dedupMap = new Map<string, StoredPushSubscription>();
  for (const sub of matchingSubs) {
    if (!sub.endpoint) continue;
    const existing = dedupMap.get(sub.endpoint);
    if (!existing || (sub.updatedAt || "") > (existing.updatedAt || "")) {
      dedupMap.set(sub.endpoint, sub as StoredPushSubscription);
    }
  }

  const finalDevices = Array.from(dedupMap.values());
  let totalDelivered = 0;

  await Promise.all(
    finalDevices.map(async (sub) => {
      try {
        const res = await sendToSubscriptionRecord(sub, payload);
        if (res.success) totalDelivered++;
      } catch (err) {
        console.warn(`[WebPush] Device dispatch error for ${sub.id}:`, err);
      }
    }),
  );

  console.log(
    `[WebPush] Delivered "${payload.title}" to ${totalDelivered}/${finalDevices.length} matching device(s)`,
  );

  return { totalUsers: targetIdSet.size, totalDelivered };
}

/**
 * Send notification to all students registered in a course
 */
export async function sendNotificationToCourseStudents(
  courseId: string,
  payload: NotificationPayload,
): Promise<{ studentsCount: number; delivered: number }> {
  try {
    const cleanCourseId = String(courseId).trim();

    // 1. Fetch registrations for this course
    const registrations = await queryCollectionRest("course_registrations", {
      where: [{ field: "course_id", op: "EQUAL", value: cleanCourseId }],
    });

    const studentIds = registrations.map((r: any) => r.student_id).filter(Boolean);

    // 2. Fetch student records and resolve to canonical IDs (both document ID and index_number)
    const studentUserIds = new Set<string>();

    for (const sid of studentIds) {
      studentUserIds.add(String(sid).trim());
      const studentDoc = await getDocRest("students", sid).catch(() => null);
      if (studentDoc && studentDoc.index_number) {
        studentUserIds.add(studentDoc.index_number.trim());
      }
    }

    // 3. In case courses match cohort level and department
    const courseDoc = await getDocRest("courses", cleanCourseId).catch(() => null);
    if (courseDoc && courseDoc.owner_id && courseDoc.department_id) {
      const cohortStudents = await queryCollectionRest("students", {
        where: [
          { field: "owner_id", op: "EQUAL", value: courseDoc.owner_id },
          { field: "department_id", op: "EQUAL", value: courseDoc.department_id },
        ],
      });

      for (const s of cohortStudents) {
        if (s.id) studentUserIds.add(String(s.id).trim());
        if (s.index_number) studentUserIds.add(String(s.index_number).trim());
      }
    }

    const recipientList = Array.from(studentUserIds);
    console.log(
      `[WebPush] Resolved ${recipientList.length} canonical student ID(s) for course ${cleanCourseId}`,
    );

    if (recipientList.length === 0) {
      console.log(
        `[WebPush] No course registrations found for course ${cleanCourseId}. Falling back to active student devices.`,
      );
      const broadcastRes = await sendNotificationToAllActive(payload, "student");
      return { studentsCount: broadcastRes.totalDevices, delivered: broadcastRes.totalDelivered };
    }

    const res = await sendNotificationToUsers(recipientList, payload);
    return { studentsCount: recipientList.length, delivered: res.totalDelivered };
  } catch (err) {
    console.error("[WebPush] Failed to send notification to course:", err);
    return { studentsCount: 0, delivered: 0 };
  }
}

/**
 * Broadcast notification to all active devices/users (or filtered by role) with endpoint deduplication
 */
export async function sendNotificationToAllActive(
  payload: NotificationPayload,
  targetRole?: "student" | "lecturer" | "admin",
): Promise<{ totalDevices: number; totalDelivered: number }> {
  try {
    const filters: any[] = [{ field: "isActive", op: "EQUAL", value: true }];
    if (targetRole) {
      filters.push({ field: "userRole", op: "EQUAL", value: targetRole });
    }

    const rawSubscriptions = await queryCollectionRest("push_subscriptions", {
      where: filters,
    });

    if (rawSubscriptions.length === 0) {
      return { totalDevices: 0, totalDelivered: 0 };
    }

    // Deduplicate by endpoint to ensure each physical device is pinged only once
    const dedupMap = new Map<string, StoredPushSubscription>();
    for (const sub of rawSubscriptions) {
      if (!sub.endpoint) continue;
      const existing = dedupMap.get(sub.endpoint);
      if (!existing || (sub.updatedAt || "") > (existing.updatedAt || "")) {
        dedupMap.set(sub.endpoint, sub as StoredPushSubscription);
      }
    }
    const subscriptions = Array.from(dedupMap.values());

    // Record in-app notification for each unique user
    const uniqueUserIds = Array.from(
      new Set(subscriptions.map((s: any) => s.userId).filter(Boolean)),
    );
    await Promise.all(
      uniqueUserIds.map((uid) =>
        saveInAppNotification(String(uid), payload).catch(() => {}),
      ),
    );

    // Send push notification to devices in chunks
    let delivered = 0;
    const chunkSize = 10;
    for (let i = 0; i < subscriptions.length; i += chunkSize) {
      const chunk = subscriptions.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map((sub: any) =>
          sendToSubscriptionRecord(sub as StoredPushSubscription, payload).catch(
            () => ({ success: false }),
          ),
        ),
      );
      delivered += results.filter((r) => r.success).length;
    }

    console.log(
      `[WebPush] Broadcast complete: "${payload.title}" (${delivered}/${subscriptions.length} devices delivered)`,
    );

    return { totalDevices: subscriptions.length, totalDelivered: delivered };
  } catch (err) {
    console.error("[WebPush] Broadcast error:", err);
    return { totalDevices: 0, totalDelivered: 0 };
  }
}

