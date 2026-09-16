import { createFileRoute } from "@tanstack/react-router";
import {
  savePushSubscription,
  removePushSubscription,
} from "@/lib/push-service.server";

export const Route = createFileRoute("/api/push/subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { subscription, userContext, device } = body;

          if (!subscription || !subscription.endpoint || !subscription.keys) {
            return Response.json(
              { error: "Invalid push subscription object" },
              { status: 400 },
            );
          }

          const userId = (userContext?.userId || "").trim();
          if (!userId) {
            return Response.json(
              { error: "Authentication identity (userId) is required" },
              { status: 401 },
            );
          }

          const userRole = userContext?.userRole || "student";
          const studentId = (userContext?.studentId || "").trim();
          const indexNumber = (userContext?.indexNumber || userContext?.userId || "").trim();

          const saved = await savePushSubscription(userId, userRole, subscription, {
            ...device,
            studentId,
            indexNumber,
          });

          return Response.json({
            success: true,
            message: "Push subscription registered successfully",
            id: saved.id,
            platform: saved.platform,
            createdAt: saved.createdAt,
          });
        } catch (err: any) {
          console.error("[API /api/push/subscribe] Error:", err);
          return Response.json(
            { error: err.message || "Failed to register push subscription" },
            { status: 500 },
          );
        }
      },

      DELETE: async ({ request }) => {
        try {
          const body = await request.json();
          const { endpoint, userId } = body;

          if (!endpoint) {
            return Response.json({ error: "Endpoint is required" }, { status: 400 });
          }

          const success = await removePushSubscription(endpoint, userId);
          return Response.json({ success });
        } catch (err: any) {
          console.error("[API /api/push/subscribe DELETE] Error:", err);
          return Response.json(
            { error: err.message || "Failed to remove push subscription" },
            { status: 500 },
          );
        }
      },
    },
  },
});
