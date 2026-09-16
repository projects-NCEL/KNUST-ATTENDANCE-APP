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
        const altId = (url.searchParams.get("altId") || "").trim();

        if (!userId && !altId) {
          return Response.json({ error: "userId is required" }, { status: 400 });
        }

        try {
          const idsToQuery = Array.from(
            new Set([userId, altId, "all", "students", "broadcast_student"].filter(Boolean)),
          );

          const lists = await Promise.all(
            idsToQuery.map((targetId) =>
              queryCollectionRest("in_app_notifications", {
                where: [{ field: "userId", op: "EQUAL", value: targetId }],
                limit: 30,
              }).catch(() => []),
            ),
          );

          const seen = new Set<string>();
          const combined: any[] = [];
          for (const list of lists) {
            for (const item of list) {
              if (item.id && !seen.has(item.id)) {
                seen.add(item.id);
                combined.push(item);
              }
            }
          }

          // Sort by createdAt descending
          combined.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          return Response.json({ notifications: combined });
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
