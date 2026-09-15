import { createFileRoute } from "@tanstack/react-router";
import { getDocRest, setDocRest } from "@/integrations/firebase/firestore-rest";

export const Route = createFileRoute("/api/push/preferences")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const userId = (url.searchParams.get("userId") || "").trim();

        if (!userId) {
          return Response.json({ error: "userId parameter is required" }, { status: 400 });
        }

        try {
          const pref = await getDocRest("notification_preferences", userId);
          const defaults = {
            pushEnabled: true,
            attendance: true,
            announcements: true,
            assignments: true,
            deadlines: true,
            system: true,
          };
          return Response.json({ preferences: pref ? { ...defaults, ...pref } : defaults });
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { userId, preferences } = body;

          const cleanId = (userId || "").trim();
          if (!cleanId) {
            return Response.json({ error: "userId is required" }, { status: 400 });
          }

          const toSave = {
            ...preferences,
            userId: cleanId,
            updatedAt: new Date().toISOString(),
          };

          await setDocRest("notification_preferences", cleanId, toSave, true);
          return Response.json({ success: true, preferences: toSave });
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 });
        }
      },
    },
  },
});
