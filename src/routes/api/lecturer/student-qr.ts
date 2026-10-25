import { createFileRoute } from "@tanstack/react-router";
import { verifyLecturerRequest } from "@/integrations/firebase/admin.server";
import { queryCollectionRest, isFirestoreQuotaError } from "@/integrations/firebase/firestore-rest";

export const Route = createFileRoute("/api/lecturer/student-qr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const uid = await verifyLecturerRequest(request);
          if (!uid) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const body = await request.json().catch(() => ({}));
          const rawList: string[] = Array.isArray(body?.indexes)
            ? body.indexes
            : Array.isArray(body?.index_numbers)
              ? body.index_numbers
              : [];

          if (rawList.length === 0) {
            return Response.json({ qr: {} });
          }

          // Build search terms including both original trimmed and uppercase versions
          const searchTerms = Array.from(
            new Set(
              rawList
                .flatMap((idx) => {
                  const orig = String(idx || "").trim();
                  const upper = orig.toUpperCase();
                  return [orig, upper];
                })
                .filter(Boolean),
            ),
          );

          const qr: Record<string, string> = {};

          // Chunk into batches of 30 for Firestore IN queries
          const chunkSize = 30;
          for (let i = 0; i < searchTerms.length; i += chunkSize) {
            const chunk = searchTerms.slice(i, i + chunkSize);
            try {
              const students = await queryCollectionRest("students", {
                where: [{ field: "index_number", op: "IN", value: chunk }],
                limit: 100,
              });
              for (const s of students) {
                const sIdx = String(s.index_number || "").trim().toUpperCase();
                if (sIdx && s.qr_uuid && !qr[sIdx]) {
                  qr[sIdx] = s.qr_uuid;
                }
              }
            } catch (err) {
              console.warn("[student-qr] Chunk query warning:", err);
            }
          }

          return Response.json({ qr });
        } catch (err: any) {
          const errMsg = err?.message || String(err) || "Internal server error";
          if (isFirestoreQuotaError(500, errMsg)) {
            return Response.json(
              { error: "Database quota exceeded. Please try again later.", quotaExceeded: true },
              { status: 429 },
            );
          }
          console.error("[student-qr] Error:", err);
          return Response.json({ error: errMsg }, { status: 500 });
        }
      },
    },
  },
});
