import { createFileRoute } from "@tanstack/react-router";
import {
  sendNotificationToUser,
  sendNotificationToUsers,
  sendNotificationToCourseStudents,
  NotificationPayload,
} from "@/lib/push-service.server";

export const Route = createFileRoute("/api/push/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { userId, userIds, courseId, payload } = body as {
            userId?: string;
            userIds?: string[];
            courseId?: string;
            payload: NotificationPayload;
          };

          if (!payload || !payload.title) {
            return Response.json(
              { error: "Notification payload with title is required" },
              { status: 400 },
            );
          }

          // Case 1: Send to a specific course's enrolled students
          if (courseId) {
            const res = await sendNotificationToCourseStudents(courseId, payload);
            return Response.json({
              success: true,
              mode: "course",
              studentsCount: res.studentsCount,
              delivered: res.delivered,
            });
          }

          // Case 2: Send to specific multiple users
          if (Array.isArray(userIds) && userIds.length > 0) {
            const res = await sendNotificationToUsers(userIds, payload);
            return Response.json({
              success: true,
              mode: "users",
              totalUsers: res.totalUsers,
              delivered: res.totalDelivered,
            });
          }

          // Case 3: Send to a single user (e.g. Test notification or direct alert)
          if (userId) {
            const res = await sendNotificationToUser(userId, payload);
            return Response.json({
              success: true,
              mode: "user",
              targetDevices: res.targetDevices,
              delivered: res.successful,
              failed: res.failed,
            });
          }

          return Response.json(
            { error: "Must provide either courseId, userIds, or userId" },
            { status: 400 },
          );
        } catch (err: any) {
          console.error("[API /api/push/send] Error:", err);
          return Response.json(
            { error: err.message || "Failed to dispatch push notification" },
            { status: 500 },
          );
        }
      },
    },
  },
});
