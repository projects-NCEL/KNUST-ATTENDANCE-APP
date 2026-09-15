import { createFileRoute } from "@tanstack/react-router";
import {
  queryCollectionRest,
  setDocRest,
} from "@/integrations/firebase/firestore-rest";

export const Route = createFileRoute("/api/push/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const userId = (url.searchParams.get("userId") || "").trim();

        if (!userId) {
          return Response.json({ error: "userId is required" }, { status: 400 });
        }

        try {
          const list = await queryCollectionRest("in_app_notifications", {
            where: [{ field: "userId", op: "EQUAL", value: userId }],
            limit: 50,
          });

          // Sort by createdAt descending
          list.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          return Response.json({ notifications: list });
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { notificationId, markAllRead, userId } = body;

          if (markAllRead && userId) {
            const list = await queryCollectionRest("in_app_notifications", {
              where: [{ field: "userId", op: "EQUAL", value: userId }],
              limit: 50,
            });
            await Promise.all(
              list
                .filter((n) => !n.isRead)
                .map((n) => setDocRest("in_app_notifications", n.id, { isRead: true }, true)),
            );
            return Response.json({ success: true, count: list.length });
          }

          if (notificationId) {
            await setDocRest("in_app_notifications", notificationId, { isRead: true }, true);
            return Response.json({ success: true });
          }

          return Response.json({ error: "Invalid parameters" }, { status: 400 });
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 });
        }
      },
    },
  },
});
