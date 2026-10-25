import { createFileRoute } from "@tanstack/react-router";
import {
  getDocRest,
  setDocRest,
  queryCollectionRest,
  countRest,
  isFirestoreQuotaError,
} from "@/integrations/firebase/firestore-rest";
import { randomBytes } from "crypto";

function sanitizeDocId(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export const Route = createFileRoute("/api/public/portal-link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { action, token } = body;

          if (!token) {
            return Response.json({ error: "Portal token is required" }, { status: 400 });
          }

          // Verify portal link token
          const portalLinks = await queryCollectionRest("student_portal_links", {
            where: [
              { field: "token", op: "EQUAL", value: token },
              { field: "is_active", op: "EQUAL", value: true },
            ],
            limit: 1,
          });

          if (!portalLinks || portalLinks.length === 0) {
            return Response.json(
              { error: "Invalid or expired portal link." },
              { status: 404 },
            );
          }

          const portalData = portalLinks[0];
          const portalOwnerId = portalData.owner_id;

          if (!portalOwnerId) {
            return Response.json({ error: "Portal owner not found." }, { status: 400 });
          }

          // ACTION: INFO
          if (action === "info") {
            const departments = await queryCollectionRest("departments", {
              where: [{ field: "owner_id", op: "EQUAL", value: portalOwnerId }],
              limit: 100,
            }).catch(() => []);

            let course = null;
            if (portalData.course_id) {
              course = await getDocRest("courses", portalData.course_id).catch(() => null);
            }

            const defaultLevels = ["100", "200", "300", "400", "500", "600"];
            let levels = defaultLevels;
            if (course?.level) {
              const lvlStr = String(course.level).replace(/\D/g, "");
              if (lvlStr) {
                levels = [lvlStr];
              }
            }

            return Response.json({
              ok: true,
              portal: {
                id: portalData.id,
                owner_id: portalOwnerId,
                course_id: portalData.course_id || null,
                course_code: course?.code || portalData.course_code || "",
                course_title: course?.title || portalData.course_title || "",
              },
              departments: departments
                .map((d: any) => ({
                  id: d.id,
                  name: d.name || "",
                  code: d.code || "",
                }))
                .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "")),
              levels,
            });
          }

          // ACTION: LOOKUP
          if (action === "lookup") {
            const { index, email } = body;
            const cleanIndex = String(index || "").trim().toUpperCase();
            const cleanEmail = String(email || "").trim().toLowerCase();

            if (!cleanIndex) {
              return Response.json({ error: "Index number is required" }, { status: 400 });
            }

            const studentDocs = await queryCollectionRest("students", {
              where: [
                { field: "owner_id", op: "EQUAL", value: portalOwnerId },
                { field: "index_number", op: "EQUAL", value: cleanIndex },
              ],
              limit: 1,
            });

            if (!studentDocs || studentDocs.length === 0) {
              return Response.json(
                { error: "No match. Check your index number and email." },
                { status: 404 },
              );
            }

            const sData = studentDocs[0];
            if (sData.email && cleanEmail && sData.email.toLowerCase() !== cleanEmail) {
              return Response.json(
                { error: "Email does not match our records for this index number." },
                { status: 400 },
              );
            }

            let qrUuid = sData.qr_uuid;
            if (!qrUuid) {
              qrUuid = randomBytes(16).toString("hex");
              await setDocRest("students", sData.id, { qr_uuid: qrUuid }, true).catch(() => {});
            }

            let deptName = sData.program || sData.department_name || "General";
            if (sData.department_id) {
              const deptDoc = await getDocRest("departments", sData.department_id).catch(() => null);
              if (deptDoc?.name) deptName = deptDoc.name;
            }

            return Response.json({
              ok: true,
              student: {
                full_name: sData.full_name || "",
                index_number: sData.index_number || cleanIndex,
                level: sData.level || "100",
                department: deptName,
                qr_uuid: qrUuid,
                pin: qrUuid.slice(-4).toUpperCase(),
              },
            });
          }

          // ACTION: REGISTER
          if (action === "register") {
            const { full_name, index, email, level, department_id, program } = body;
            const cleanName = String(full_name || "").trim();
            const cleanIndex = String(index || "").trim().toUpperCase();
            const cleanEmail = String(email || "").trim().toLowerCase();
            const cleanLvl = String(level || "100").trim();
            const cleanDeptId = String(department_id || "").trim();
            const cleanProg = String(program || "").trim();

            if (!cleanName || !cleanIndex) {
              return Response.json(
                { error: "Full legal name and index number are required." },
                { status: 400 },
              );
            }

            // Check max 400 students per level for this lecturer
            const currentLevelCount = await countRest("students", [
              { field: "owner_id", op: "EQUAL", value: portalOwnerId },
              { field: "level", op: "EQUAL", value: cleanLvl },
            ]);
            if (currentLevelCount >= 400) {
              return Response.json(
                { error: "Level limit reached (400 students max)" },
                { status: 400 },
              );
            }

            // Check if student already exists for this lecturer
            const existingForLecturer = await queryCollectionRest("students", {
              where: [
                { field: "owner_id", op: "EQUAL", value: portalOwnerId },
                { field: "index_number", op: "EQUAL", value: cleanIndex },
              ],
              limit: 1,
            });

            if (existingForLecturer.length > 0) {
              const existing = existingForLecturer[0];
              let deptName = existing.program || existing.department_name || "General";
              if (existing.department_id) {
                const deptDoc = await getDocRest("departments", existing.department_id).catch(() => null);
                if (deptDoc?.name) deptName = deptDoc.name;
              }

              let qrUuid = existing.qr_uuid;
              if (!qrUuid) {
                qrUuid = randomBytes(16).toString("hex");
                await setDocRest("students", existing.id, { qr_uuid: qrUuid }, true).catch(() => {});
              }

              return Response.json({
                ok: true,
                existed: true,
                student: {
                  full_name: existing.full_name || cleanName,
                  index_number: existing.index_number || cleanIndex,
                  level: existing.level || cleanLvl,
                  department: deptName,
                  qr_uuid: qrUuid,
                  pin: qrUuid.slice(-4).toUpperCase(),
                },
              });
            }

            // Student doesn't exist for this lecturer. Look for existing QR UUID across any lecturer
            let qrUuid = "";
            const anyStudent = await queryCollectionRest("students", {
              where: [{ field: "index_number", op: "EQUAL", value: cleanIndex }],
              limit: 1,
            });
            if (anyStudent.length > 0 && anyStudent[0].qr_uuid) {
              qrUuid = anyStudent[0].qr_uuid;
            } else {
              qrUuid = randomBytes(16).toString("hex");
            }

            let deptName = cleanProg || "General";
            if (cleanDeptId) {
              const deptDoc = await getDocRest("departments", cleanDeptId).catch(() => null);
              if (deptDoc?.name) deptName = deptDoc.name;
            }

            const cleanKey = sanitizeDocId(cleanIndex);
            const studentDocId = sanitizeDocId(`stud_${cleanKey}_${portalOwnerId}`);
            const nowIso = new Date().toISOString();

            const studentPayload = {
              owner_id: portalOwnerId,
              index_number: cleanIndex,
              full_name: cleanName,
              email: cleanEmail || null,
              level: cleanLvl,
              department_id: cleanDeptId || null,
              department_name: deptName,
              program: cleanProg || deptName,
              qr_uuid: qrUuid,
              created_at: nowIso,
              registered_via: "portal_link",
            };

            await setDocRest("students", studentDocId, studentPayload, true);

            // If portal link has course_id, also register student for the course
            if (portalData.course_id) {
              const regDocId = sanitizeDocId(`reg_${cleanKey}_${portalData.course_id}`);
              await setDocRest(
                "course_registrations",
                regDocId,
                {
                  owner_id: portalOwnerId,
                  course_id: portalData.course_id,
                  student_id: studentDocId,
                  index_number: cleanIndex,
                  student_name: cleanName,
                  registered_at: nowIso,
                },
                true,
              ).catch(() => {});
            }

            // Bump lecturer's roster version
            await setDocRest("users", portalOwnerId, { roster_version: Date.now() }, true).catch(() => {});

            return Response.json({
              ok: true,
              existed: false,
              student: {
                full_name: cleanName,
                index_number: cleanIndex,
                level: cleanLvl,
                department: deptName,
                qr_uuid: qrUuid,
                pin: qrUuid.slice(-4).toUpperCase(),
              },
            });
          }

          return Response.json({ error: "Invalid action" }, { status: 400 });
        } catch (err: any) {
          const errMsg = err?.message || String(err) || "Internal server error";
          if (isFirestoreQuotaError(500, errMsg)) {
            return Response.json(
              {
                error: "Database free daily read quota reached. Please try again later.",
                quotaExceeded: true,
              },
              { status: 429 },
            );
          }
          console.error("Portal link error:", err);
          return Response.json({ error: errMsg }, { status: 500 });
        }
      },
    },
  },
});
