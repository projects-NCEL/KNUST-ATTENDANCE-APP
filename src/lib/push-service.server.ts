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
  } = {},
): Promise<StoredPushSubscription> {
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new Error("Invalid push subscription format");
  }

  const docId = getSubscriptionDocId(subscription.endpoint);
  const now = new Date().toISOString();

  // Check if existing record exists
  const existing = await getDocRest("push_subscriptions", docId);

  const subDoc: StoredPushSubscription = {
    id: docId,
    userId: String(userId).trim(),
    userRole,
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

  await setDocRest("push_subscriptions", docId, subDoc, true);
  console.log(`[WebPush] Subscription saved for user ${userId} on ${subDoc.platform}/${subDoc.browser}`);
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

/** Low-level sender to a single subscription document */
async function sendToSubscriptionRecord(
  sub: StoredPushSubscription,
  payload: NotificationPayload,
): Promise<{ success: boolean; expired?: boolean; error?: string }> {
  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/favicon.png",
    badge: payload.badge || "/favicon.png",
    url: payload.url || "/",
    entityId: payload.entityId,
    entityType: payload.entityType,
    type: payload.type,
    tag: payload.tag,
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

  // Query all active devices for this user
  const subscriptions = await queryCollectionRest("push_subscriptions", {
    where: [
      { field: "userId", op: "EQUAL", value: cleanId },
      { field: "isActive", op: "EQUAL", value: true },
    ],
  });

  if (subscriptions.length === 0) {
    return { targetDevices: 0, successful: 0, failed: 0 };
  }

  let successful = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const res = await sendToSubscriptionRecord(sub as StoredPushSubscription, payload);
    if (res.success) {
      successful++;
    } else {
      failed++;
    }
  }

  console.log(
    `[WebPush] Sent "${payload.title}" to user ${cleanId} (${successful}/${subscriptions.length} devices delivered)`,
  );

  return { targetDevices: subscriptions.length, successful, failed };
}

/**
 * Send notification to a list of users concurrently with bounded batches
 */
export async function sendNotificationToUsers(
  userIds: string[],
  payload: NotificationPayload,
): Promise<{ totalUsers: number; totalDelivered: number }> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean).map((id) => String(id).trim())));
  if (uniqueIds.length === 0) return { totalUsers: 0, totalDelivered: 0 };

  console.log(`[WebPush] Broadcasting "${payload.title}" to ${uniqueIds.length} users`);

  let totalDelivered = 0;
  const batchSize = 10;

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const chunk = uniqueIds.slice(i, i + batchSize);
    const results = await Promise.all(
      chunk.map((uid) =>
        sendNotificationToUser(uid, payload).catch((err) => {
          console.error(`[WebPush] Error dispatching to user ${uid}:`, err);
          return { targetDevices: 0, successful: 0, failed: 0 };
        }),
      ),
    );
    totalDelivered += results.reduce((acc, r) => acc + r.successful, 0);
  }

  return { totalUsers: uniqueIds.length, totalDelivered };
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

    // 2. Fetch student records to get both student doc id and index_number
    const studentUserIds = new Set<string>();

    for (const sid of studentIds) {
      studentUserIds.add(sid);
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
        studentUserIds.add(s.id);
        if (s.index_number) {
          studentUserIds.add(s.index_number.trim());
        }
      }
    }

    const recipientList = Array.from(studentUserIds);
    console.log(
      `[WebPush] Resolved ${recipientList.length} candidate student identifier(s) for course ${cleanCourseId}`,
    );

    const res = await sendNotificationToUsers(recipientList, payload);
    return { studentsCount: recipientList.length, delivered: res.totalDelivered };
  } catch (err) {
    console.error("[WebPush] Failed to send notification to course:", err);
    return { studentsCount: 0, delivered: 0 };
  }
}
