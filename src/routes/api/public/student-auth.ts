import { createFileRoute } from "@tanstack/react-router";
import {
  getDocRest,
  setDocRest,
  queryCollectionRest,
  isFirestoreQuotaError,
} from "@/integrations/firebase/firestore-rest";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const DEFAULT_KNUST_DEPARTMENTS = [
  { id: "cs", name: "Department of Computer Science", code: "CSM" },
  { id: "eee", name: "Department of Electrical & Electronic Engineering", code: "EEE" },
  { id: "ce", name: "Department of Computer Engineering", code: "COE" },
  { id: "me", name: "Department of Mechanical Engineering", code: "ME" },
  { id: "civ", name: "Department of Civil Engineering", code: "CE" },
  { id: "chem", name: "Department of Chemical Engineering", code: "CHE" },
  { id: "mat", name: "Department of Materials Engineering", code: "MSE" },
  { id: "math", name: "Department of Mathematics", code: "MATH" },
  { id: "phys", name: "Department of Physics", code: "PHYS" },
  { id: "biochem", name: "Department of Biochemistry & Biotechnology", code: "BCB" },
  { id: "nurs", name: "Department of Nursing", code: "NUR" },
  { id: "pharm", name: "Department of Pharmacy", code: "PHARM" },
  { id: "med", name: "School of Medicine & Dentistry", code: "SMS" },
  { id: "ksb", name: "KNUST School of Business", code: "KSB" },
  { id: "law", name: "Faculty of Law", code: "LAW" },
  { id: "arch", name: "Department of Architecture", code: "ARCH" },
  { id: "gen", name: "General Studies", code: "GEN" },
];

function sanitizeDocId(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function normalizeLevel(val: any): string {
  if (!val) return "";
  const str = String(val).trim().toUpperCase();
  const digits = str.replace(/^(LEVEL|LVL|L)\s*/i, "").trim();
  return digits || str;
}

function levelMatches(courseLevel: any, studentLevel: any): boolean {
  if (!courseLevel || !studentLevel) return false;
  const cNorm = normalizeLevel(courseLevel);
  const sNorm = normalizeLevel(studentLevel);
  if (cNorm === sNorm) return true;
  const cDigits = cNorm.replace(/\D/g, "");
  const sDigits = sNorm.replace(/\D/g, "");
  if (cDigits && cDigits === sDigits) return true;
  return false;
}

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const calculated = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    const a = Buffer.from(calculated, "hex");
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// In-memory rate limiter with fallback to prevent lockouts
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

async function checkRateLimit(
  ip: string,
  index: string,
): Promise<{ allowed: boolean; retryAfterMinutes?: number }> {
  const key = sanitizeDocId(`${ip}_${index}`);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;

  try {
    const entry = memoryRateLimits.get(key);
    if (!entry || now > entry.resetAt) {
      memoryRateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }

    if (entry.count >= 8) {
      const retryAfterMinutes = Math.max(1, Math.ceil((entry.resetAt - now) / 60000));
      return { allowed: false, retryAfterMinutes };
    }

    entry.count += 1;
    return { allowed: true };
  } catch (err) {
    console.error("Rate limit error:", err);
    return { allowed: true };
  }
}

export const Route = createFileRoute("/api/public/student-auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { action, index, email, password, new_password } = body;
          const cleanIndex = (index || "").trim();

          if (!cleanIndex) {
            return Response.json({ error: "Index number is required" }, { status: 400 });
          }

          // Rate limit checks for password modification attempts
          if (
            action === "set_password" ||
            action === "reset_password" ||
            action === "change_password"
          ) {
            const clientIp =
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              request.headers.get("cf-connecting-ip") ||
              "client";

            const rateCheck = await checkRateLimit(clientIp, cleanIndex);
            if (!rateCheck.allowed) {
              return Response.json(
                {
                  error: `Too many password attempts. Please wait ${rateCheck.retryAfterMinutes} minute(s) before trying again.`,
                },
                { status: 429 },
              );
            }
          }

          // ACTION: Fetch Departments for Registration
          if (action === "departments") {
            try {
              const depts = await queryCollectionRest("departments", { limit: 100 });
              if (depts && depts.length > 0) {
                return Response.json({
                  departments: depts.map((d: any) => ({
                    id: d.id,
                    name: d.name || "",
                    code: d.code || "",
                  })),
                });
              }
            } catch (deptErr: any) {
              console.warn(
                "Notice: Cloud departments query unavailable, serving standard KNUST department directory:",
                deptErr?.message || deptErr,
              );
            }
            return Response.json({ departments: DEFAULT_KNUST_DEPARTMENTS });
          }

          // ACTION: Register New Student (Self-Registration)
          if (action === "register_new_student") {
            const { full_name, level, program, email, password } = body;
            const cleanName = (full_name || "").trim();
            const cleanEmail = (email || "").trim().toLowerCase();
            const cleanProg = (program || "General").trim();
            const cleanLvl = String(level || "100").trim();
            const upperIndex = cleanIndex.toUpperCase();

            if (!cleanName) {
              return Response.json({ error: "Full legal name is required" }, { status: 400 });
            }
            if (!password || password.length < 6) {
              return Response.json(
                { error: "Password must be at least 6 characters" },
                { status: 400 },
              );
            }

            // Check if student with this index number already exists
            let existingStudents = await queryCollectionRest("students", {
              where: [{ field: "index_number", op: "EQUAL", value: cleanIndex }],
            });
            if (existingStudents.length === 0 && cleanIndex !== upperIndex) {
              existingStudents = await queryCollectionRest("students", {
                where: [{ field: "index_number", op: "EQUAL", value: upperIndex }],
              });
            }

            if (existingStudents.length > 0) {
              return Response.json(
                {
                  error: `Index number ${upperIndex} is already registered. Please sign in or use reset password if you forgot your credentials.`,
                  already_exists: true,
                },
                { status: 409 },
              );
            }

            // Generate UUID for QR
            const newQrUuid = randomBytes(16).toString("hex");
            const newStudentDocId = sanitizeDocId(`stud_${upperIndex}`);

            const newStudentData = {
              full_name: cleanName,
              index_number: upperIndex,
              level: cleanLvl,
              program: cleanProg,
              email: cleanEmail,
              qr_uuid: newQrUuid,
              owner_id: "universal",
              created_at: new Date().toISOString(),
              self_registered: true,
            };

            await setDocRest("students", newStudentDocId, newStudentData);

            // Create account with password
            const salt = randomBytes(16).toString("hex");
            const hash = hashPassword(password, salt);

            const accountPayload = {
              student_id: newStudentDocId,
              index_number: upperIndex,
              email: cleanEmail,
              password_salt: salt,
              password_hash: hash,
              updated_at: new Date().toISOString(),
            };

            await setDocRest("student_accounts", newStudentDocId, accountPayload);
            await setDocRest("student_accounts", sanitizeDocId(upperIndex), accountPayload);

            return Response.json({
              ok: true,
              message: "Student registration completed successfully!",
              student: {
                id: newStudentDocId,
                full_name: cleanName,
                index_number: upperIndex,
                level: cleanLvl,
                program: cleanProg,
                email: cleanEmail,
                qr_uuid: newQrUuid,
                lecturers_count: 1,
              },
            });
          }

          // ACTION: Fetch currently open lecturer sessions for student check-in
          if (action === "get_active_sessions") {
            const allSessions = await queryCollectionRest("attendance_sessions", { limit: 50 });
            const openSessions = allSessions.filter((s: any) => {
              const status = (s.status || "").toUpperCase();
              return status === "OPEN" || status === "ACTIVE" || (s.is_active === true && status !== "CLOSED");
            });

            const courses = await queryCollectionRest("courses", { limit: 100 }).catch(() => []);
            const courseMap = new Map<string, any>();
            courses.forEach((c) => courseMap.set(c.id, c));

            const enriched = openSessions.map((s: any) => {
              const c = s.course_id ? courseMap.get(s.course_id) : null;
              return {
                id: s.id,
                title: s.title || c?.title || "Class Attendance",
                courseCode: c?.code || s.course_code || "",
                courseTitle: c?.title || s.course_title || "",
                session_number: s.session_number,
                latitude: typeof s.latitude === "number" ? s.latitude : null,
                longitude: typeof s.longitude === "number" ? s.longitude : null,
                radius_m: s.radius_m || 100,
                status: "OPEN",
                is_active: true,
                owner_id: s.owner_id,
                course_id: s.course_id,
                starts_at: s.starts_at || s.created_at || null,
              };
            });

            return Response.json({ ok: true, sessions: enriched });
          }

          // ACTION: Projector QR Check-in (Direct attendance recording)
          if (action === "projector_check_in") {
            const { session_id, user_lat, user_lng, accuracy, distance_m, geofence_flagged } = body;
            const upperIndex = cleanIndex.toUpperCase();

            if (!session_id) {
              return Response.json({ error: "Session ID is required" }, { status: 400 });
            }

            // 1. Verify session exists and is active
            const sessionData = await getDocRest("attendance_sessions", session_id);
            if (!sessionData) {
              return Response.json(
                { error: "Attendance session not found or has expired." },
                { status: 404 },
              );
            }

            if (sessionData.status === "CLOSED" || sessionData.is_active === false) {
              return Response.json(
                { error: "This attendance session has already been closed by the lecturer." },
                { status: 400 },
              );
            }

            // 2. Find student by index number
            let studentDocs = await queryCollectionRest("students", {
              where: [{ field: "index_number", op: "EQUAL", value: cleanIndex }],
            });
            if (studentDocs.length === 0 && cleanIndex !== upperIndex) {
              studentDocs = await queryCollectionRest("students", {
                where: [{ field: "index_number", op: "EQUAL", value: upperIndex }],
              });
            }

            let studentDocId = studentDocs[0]?.id;
            let studentFullName = studentDocs[0]?.full_name || studentDocs[0]?.name;

            if (!studentDocId) {
              studentDocId = sanitizeDocId(`stud_${upperIndex}`);
              studentFullName = `Student (${upperIndex})`;
              // Auto-create student doc so they exist in student list
              try {
                await setDocRest("students", studentDocId, {
                  full_name: studentFullName,
                  index_number: upperIndex,
                  level: sessionData.level ? String(sessionData.level) : "100",
                  owner_id: sessionData.owner_id || null,
                  created_at: new Date().toISOString(),
                });
              } catch (createErr) {
                console.warn("Auto-create student note:", createErr);
              }
            }

            // 3. Duplicate check for this session
            const existingRecords = await queryCollectionRest("attendance_records", {
              where: [{ field: "session_id", op: "EQUAL", value: session_id }],
            });

            const alreadyMarked = existingRecords.find((r: any) => {
              const rIndex = (r.index_number || "").toString().trim().toUpperCase();
              const rStudentId = r.student_id;
              return rIndex === upperIndex || rStudentId === studentDocId;
            });

            const nowIso = new Date().toISOString();
            const today = nowIso.slice(0, 10);

            if (alreadyMarked) {
              const formattedTime = alreadyMarked.check_in_at
                ? new Date(alreadyMarked.check_in_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "earlier today";
              return Response.json({
                ok: true,
                already_marked: true,
                student_name: studentFullName,
                index_number: upperIndex,
                time: formattedTime,
                message: `Already marked present for this session (${formattedTime})`,
              });
            }

            // 4. Save new attendance record in Firestore
            const recordDocId = sanitizeDocId(`rec_${session_id}_${upperIndex}`);
            const recordPayload = {
              session_id,
              student_id: studentDocId,
              index_number: upperIndex,
              student_name: studentFullName,
              course_id: sessionData.course_id || null,
              owner_id: sessionData.owner_id || null,
              session_date: today,
              check_in_at: nowIso,
              status: "PRESENT",
              source: "projector_qr",
              geo_lat: typeof user_lat === "number" ? user_lat : null,
              geo_lng: typeof user_lng === "number" ? user_lng : null,
              geo_accuracy_m: typeof accuracy === "number" ? accuracy : null,
              distance_m: typeof distance_m === "number" ? distance_m : 0,
              geofence_flagged: Boolean(geofence_flagged),
              created_at: nowIso,
            };

            await setDocRest("attendance_records", recordDocId, recordPayload);

            return Response.json({
              ok: true,
              already_marked: false,
              student_name: studentFullName,
              index_number: upperIndex,
              distance_m: typeof distance_m === "number" ? distance_m : 0,
              message: `Attendance marked present for ${studentFullName}`,
            });
          }

          // 1. Fetch all student records matching this index number across all lecturers
          let matchingStudents = await queryCollectionRest("students", {
            where: [{ field: "index_number", op: "EQUAL", value: cleanIndex }],
          });

          // Fallback case-insensitive / uppercase search
          if (matchingStudents.length === 0 && cleanIndex !== cleanIndex.toUpperCase()) {
            matchingStudents = await queryCollectionRest("students", {
              where: [{ field: "index_number", op: "EQUAL", value: cleanIndex.toUpperCase() }],
            });
          }

          if (matchingStudents.length === 0) {
            return Response.json(
              {
                error:
                  "This index number is not registered by any lecturer or department yet. Please check your index number or contact your course lecturer.",
              },
              { status: 404 },
            );
          }

          // Collect all student doc IDs across different lecturers
          const allStudentIds = Array.from(new Set(matchingStudents.map((s: any) => s.id)));

          // Merge profile details so student has a unified identity
          const primaryStudent = matchingStudents[0];
          const studentId = primaryStudent.id;
          const fullName =
            matchingStudents.find((s: any) => s.full_name?.trim())?.full_name ||
            primaryStudent.full_name ||
            "Student";
          const level =
            matchingStudents.find((s: any) => s.level)?.level || primaryStudent.level || "100";
          const program =
            matchingStudents.find((s: any) => s.program?.trim())?.program ||
            primaryStudent.program ||
            "Undergraduate Degree";
          const studentEmail =
            matchingStudents.find((s: any) => s.email?.trim())?.email || primaryStudent.email || "";
          const qrUuid =
            matchingStudents.find((s: any) => s.qr_uuid?.trim())?.qr_uuid ||
            primaryStudent.qr_uuid ||
            cleanIndex;

          // 2. Fetch student account record (passwords & auth state)
          let account = null;
          for (const sid of allStudentIds) {
            account = await getDocRest("student_accounts", sid);
            if (account && account.password_hash) break;
          }
          if (!account || !account.password_hash) {
            account = await getDocRest("student_accounts", sanitizeDocId(cleanIndex));
          }

          // ACTION: Check Auth Status & Match Email
          if (action === "status" || action === "verify") {
            const hasPassword = Boolean(account && account.password_hash);
            const hasEmail = Boolean(studentEmail);
            const storedEmail = studentEmail.trim().toLowerCase();
            const inputEmail = (email || "").trim().toLowerCase();

            // Validate email if provided
            if (inputEmail) {
              if (storedEmail && inputEmail !== storedEmail) {
                return Response.json(
                  {
                    error: `The email "${email}" does not match the registered email for index number ${cleanIndex}. Please enter your registered email address or contact your course lecturer.`,
                  },
                  { status: 400 },
                );
              }
            }

            return Response.json({
              exists: true,
              has_password: hasPassword,
              has_email: hasEmail,
              email_verified: Boolean(inputEmail && (!storedEmail || inputEmail === storedEmail)),
              student: {
                id: studentId,
                full_name: fullName,
                index_number: cleanIndex,
                level: String(level),
                program,
                email: studentEmail || inputEmail,
                qr_uuid: qrUuid,
                lecturers_count: allStudentIds.length,
              },
            });
          }

          // ACTION: Set Initial Password
          if (action === "set_password") {
            if (!password || password.length < 6) {
              return Response.json(
                { error: "Password must be at least 6 characters" },
                { status: 400 },
              );
            }
            if (account && account.password_hash) {
              return Response.json(
                {
                  error:
                    "Password already set. Please sign in with your password or use reset password.",
                },
                { status: 400 },
              );
            }

            const cleanEmail = (email || "").trim().toLowerCase();
            const storedEmail = studentEmail.trim().toLowerCase();
            if (storedEmail && cleanEmail && storedEmail !== cleanEmail) {
              return Response.json(
                {
                  error: `The email "${email}" does not match the registered email for this index number.`,
                },
                { status: 400 },
              );
            }

            const salt = randomBytes(16).toString("hex");
            const hash = hashPassword(password, salt);

            // Store under primary student ID and index number key for resilience
            const accountPayload = {
              student_id: studentId,
              index_number: cleanIndex,
              email: cleanEmail || storedEmail,
              password_salt: salt,
              password_hash: hash,
              updated_at: new Date().toISOString(),
            };

            await setDocRest("student_accounts", studentId, accountPayload);
            await setDocRest("student_accounts", sanitizeDocId(cleanIndex), accountPayload);

            if (cleanEmail && !studentEmail) {
              for (const sid of allStudentIds) {
                await setDocRest("students", sid, { email: cleanEmail }, true);
              }
            }

            return Response.json({
              ok: true,
              message: "Password created successfully",
              student: {
                id: studentId,
                full_name: fullName,
                index_number: cleanIndex,
                level: String(level),
                program,
                email: cleanEmail || studentEmail,
                qr_uuid: qrUuid,
              },
            });
          }

          // ACTION: Login
          if (action === "login") {
            if (!account || !account.password_hash) {
              return Response.json(
                {
                  ok: false,
                  needs_password_setup: true,
                  message: "No password has been set yet for this index number.",
                },
                { status: 200 },
              );
            }

            const { password_salt, password_hash } = account;
            if (!verifyPassword(password, password_salt, password_hash)) {
              return Response.json(
                { ok: false, error: "Invalid password for this index number." },
                { status: 401 },
              );
            }

            return Response.json({
              ok: true,
              student: {
                id: studentId,
                full_name: fullName,
                index_number: cleanIndex,
                level: String(level),
                program,
                email: studentEmail || account.email,
                qr_uuid: qrUuid,
                lecturers_count: allStudentIds.length,
              },
            });
          }

          // ACTION: Reset Password
          if (action === "reset_password") {
            const cleanEmail = (email || "").trim().toLowerCase();
            const allPossibleEmails = [
              studentEmail,
              account?.email,
              ...matchingStudents.map((s: any) => s.email),
            ]
              .filter(Boolean)
              .map((em: string) => String(em).trim().toLowerCase());

            if (!cleanEmail) {
              return Response.json(
                { error: "Registered email address is required to reset password" },
                { status: 400 },
              );
            }

            if (allPossibleEmails.length > 0 && !allPossibleEmails.includes(cleanEmail)) {
              return Response.json(
                {
                  error: `The email "${email}" does not match the registered email for index ${cleanIndex}. Please verify your registered email address.`,
                },
                { status: 400 },
              );
            }
            if (!password || password.length < 6) {
              return Response.json(
                { error: "Password must be at least 6 characters" },
                { status: 400 },
              );
            }

            const salt = randomBytes(16).toString("hex");
            const hash = hashPassword(password, salt);

            const resetPayload = {
              student_id: studentId,
              index_number: cleanIndex,
              email: cleanEmail,
              password_salt: salt,
              password_hash: hash,
              updated_at: new Date().toISOString(),
            };

            await setDocRest("student_accounts", studentId, resetPayload);
            await setDocRest("student_accounts", sanitizeDocId(cleanIndex), resetPayload);

            for (const sid of allStudentIds) {
              await setDocRest("students", sid, { email: cleanEmail }, true);
            }

            return Response.json({
              ok: true,
              message: "Password reset successfully! You can now log in.",
              student: {
                id: studentId,
                full_name: fullName,
                index_number: cleanIndex,
                level: String(level),
                program,
                email: cleanEmail,
                qr_uuid: qrUuid,
                lecturers_count: allStudentIds.length,
              },
            });
          }

          // ACTION: Change Password (Account Settings)
          if (action === "change_password") {
            if (!account || !account.password_hash) {
              return Response.json({ error: "Account password not set yet" }, { status: 400 });
            }
            const { password_salt, password_hash } = account;
            if (!verifyPassword(password, password_salt, password_hash)) {
              return Response.json({ error: "Current password is incorrect" }, { status: 401 });
            }
            if (!new_password || new_password.length < 6) {
              return Response.json(
                { error: "New password must be at least 6 characters" },
                { status: 400 },
              );
            }

            const salt = randomBytes(16).toString("hex");
            const hash = hashPassword(new_password, salt);

            const updatedPayload = {
              student_id: studentId,
              index_number: cleanIndex,
              password_salt: salt,
              password_hash: hash,
              updated_at: new Date().toISOString(),
            };

            await setDocRest("student_accounts", studentId, updatedPayload);
            await setDocRest("student_accounts", sanitizeDocId(cleanIndex), updatedPayload);

            return Response.json({ ok: true, message: "Password changed successfully" });
          }

          // ACTION: Load Student Portal Data (Multi-Lecturer aggregation)
          if (action === "data") {
            if (!account || !account.password_hash) {
              return Response.json({ error: "Unauthorized" }, { status: 401 });
            }
            const { password_salt, password_hash } = account;
            if (!verifyPassword(password, password_salt, password_hash)) {
              return Response.json({ error: "Unauthorized" }, { status: 401 });
            }

            // 1. Query course registrations specifically for THIS student (instead of reading the whole database)
            let myRegistrations: any[] = [];
            try {
              // Try indexed query by index_number first
              myRegistrations = await queryCollectionRest("course_registrations", {
                where: [{ field: "index_number", op: "EQUAL", value: cleanIndex.toUpperCase() }],
                limit: 50,
              });
              // Also query by student_id if index_number didn't yield all
              if (myRegistrations.length === 0 && studentId) {
                myRegistrations = await queryCollectionRest("course_registrations", {
                  where: [{ field: "student_id", op: "EQUAL", value: studentId }],
                  limit: 50,
                });
              }
            } catch {
              // Fallback to bounded read if filter fails
              const partialRegistrations = await queryCollectionRest("course_registrations", { limit: 200 }).catch(() => []);
              myRegistrations = partialRegistrations.filter((r: any) => {
                if (allStudentIds.includes(r.student_id)) return true;
                if (r.index_number && r.index_number.toUpperCase() === cleanIndex.toUpperCase()) return true;
                return false;
              });
            }

            const enrolledCourseIds = Array.from(
              new Set(myRegistrations.map((r: any) => r.course_id).filter(Boolean)),
            );

            // 2. Fetch courses (bounded, cached in-memory)
            const allCourses = await queryCollectionRest("courses", { limit: 100 });
            const coursesMap = new Map<string, any>();
            allCourses.forEach((c) => coursesMap.set(c.id, c));

            // Fetch departments for department name resolution
            const allDepts = await queryCollectionRest("departments", { limit: 50 }).catch(() => []);
            const deptsMap = new Map<string, any>();
            allDepts.forEach((d: any) => deptsMap.set(d.id, d));

            // Include courses created by the student's lecturer(s) that match the student's level
            // e.g. PETROLEUM ENGINEERING THERMODYNAMICS II (L200) -> visible to all Level 200 students under that lecturer
            for (const s of matchingStudents) {
              const lecturerId = s.owner_id;
              if (!lecturerId) continue;
              const sLevel = s.level || level || "100";
              for (const c of allCourses) {
                if (c.owner_id === lecturerId && !c.archived) {
                  if (levelMatches(c.level, sLevel)) {
                    if (!enrolledCourseIds.includes(c.id)) {
                      enrolledCourseIds.push(c.id);
                    }
                  }
                }
              }
            }

            // 3. Fetch attendance records specifically for THIS student
            let myRecords: any[] = [];
            try {
              myRecords = await queryCollectionRest("attendance_records", {
                where: [{ field: "index_number", op: "EQUAL", value: cleanIndex.toUpperCase() }],
                limit: 100,
              });
              if (myRecords.length === 0 && studentId) {
                myRecords = await queryCollectionRest("attendance_records", {
                  where: [{ field: "student_id", op: "EQUAL", value: studentId }],
                  limit: 100,
                });
              }
            } catch {
              const partialRecords = await queryCollectionRest("attendance_records", { limit: 200 }).catch(() => []);
              myRecords = partialRecords.filter((r: any) => {
                if (allStudentIds.includes(r.student_id)) return true;
                if (r.index_number && r.index_number.toUpperCase() === cleanIndex.toUpperCase()) return true;
                return false;
              });
            }

            // Collect only session IDs relevant to this student's attendance to avoid reading thousands of global sessions
            const neededSessionIds = Array.from(new Set(myRecords.map((r: any) => r.session_id).filter(Boolean)));
            const allSessions = await queryCollectionRest("attendance_sessions", { limit: 100 });
            const sessionMap = new Map<string, any>();
            allSessions.forEach((s) => sessionMap.set(s.id, s));

            // Include courses from attendance sessions as well
            for (const r of myRecords) {
              const sess = sessionMap.get(r.session_id);
              if (sess?.course_id && !enrolledCourseIds.includes(sess.course_id)) {
                enrolledCourseIds.push(sess.course_id);
              }
            }

            // 4. Fetch users (lecturers) to associate course lecturer names
            const allUsers = await queryCollectionRest("users", { limit: 50 }).catch(() => []);
            const usersMap = new Map<string, any>();
            allUsers.forEach((u: any) => usersMap.set(u.id, u));

            // 5. Enrich course attendance rows with Lecturer Name, Level, Department & Metrics
            const enrichedCourses = enrolledCourseIds.map((cId) => {
              const course = coursesMap.get(cId) || {
                id: cId,
                code: "Course",
                title: "Enrolled Course",
              };

              // Identify course lecturer
              const lecturerObj = course.owner_id ? usersMap.get(course.owner_id) : null;
              const lecturerName =
                course.lecturer_name ||
                course.instructor_name ||
                lecturerObj?.full_name ||
                lecturerObj?.name ||
                (lecturerObj?.email ? lecturerObj.email.split("@")[0] : "Course Lecturer");
              const lecturerEmail = lecturerObj?.email || null;

              const courseDept = course.department_id ? deptsMap.get(course.department_id) : null;
              const deptName =
                course.department_name ||
                courseDept?.name ||
                course.program ||
                primaryStudent.program ||
                "";

              // Sessions conducted for this course
              const courseSessions = allSessions.filter((s: any) => s.course_id === cId);
              const courseSessionIds = new Set(courseSessions.map((s: any) => s.id));

              // Records for this course's sessions
              const recordsForCourse = myRecords.filter((r: any) =>
                courseSessionIds.has(r.session_id),
              );

              let attendedCount = 0;
              let lateCount = 0;

              for (const r of recordsForCourse) {
                const st = (r.status || "").toUpperCase();
                if (st === "PRESENT" || st === "ON_TIME" || st === "EXCUSED") {
                  attendedCount++;
                } else if (st === "LATE") {
                  attendedCount++;
                  lateCount++;
                }
              }

              const sessionsTotal = courseSessions.length;
              const missedCount = Math.max(0, sessionsTotal - attendedCount);
              const percentage =
                sessionsTotal > 0 ? Math.round((attendedCount / sessionsTotal) * 100) : 100;

              // Risk flag calculation: 75% threshold
              let riskLevel: "safe" | "warning" | "critical" = "safe";
              let riskMessage = "Good attendance standing (Eligible for exams)";
              if (sessionsTotal > 0 && percentage < 75) {
                riskLevel = "critical";
                riskMessage = `Below 75% threshold: Missed ${missedCount} of ${sessionsTotal} sessions. Exam eligibility at risk!`;
              } else if (sessionsTotal > 0 && missedCount >= 3) {
                riskLevel = "warning";
                riskMessage = `Caution: Missed ${missedCount} sessions. Approaching risk threshold.`;
              }

              const courseLevelDisplay = course.level
                ? String(course.level).toUpperCase().startsWith("L")
                  ? String(course.level).toUpperCase()
                  : `L${course.level}`
                : `L${level}`;

              return {
                course_id: cId,
                code: course.code || "Course",
                title: course.title || "Untitled Course",
                level: courseLevelDisplay,
                department: deptName,
                credit_hours: course.credit_hours || 2,
                semester: course.semester || "Semester",
                lecturer_name: lecturerName,
                lecturer_email: lecturerEmail,
                sessions_total: sessionsTotal,
                attended: attendedCount,
                missed: missedCount,
                late: lateCount,
                percentage,
                risk_level: riskLevel,
                risk_message: riskMessage,
              };
            });

            // Sort courses alphabetically by code
            enrichedCourses.sort((a, b) => a.code.localeCompare(b.code));

            // Format history records
            const history = myRecords
              .map((r: any) => {
                const sess = sessionMap.get(r.session_id);
                const crs = sess ? coursesMap.get(sess.course_id) : null;
                const lecturerObj = crs?.owner_id ? usersMap.get(crs.owner_id) : null;
                const lecturerName =
                  crs?.lecturer_name ||
                  crs?.instructor_name ||
                  lecturerObj?.full_name ||
                  lecturerObj?.email?.split("@")[0] ||
                  "Lecturer";

                return {
                  id: r.id,
                  session_id: r.session_id,
                  session_title: sess?.title || "Class Session",
                  course_id: sess?.course_id || "",
                  course_code: crs?.code || "",
                  course_title: crs?.title || "",
                  lecturer_name: lecturerName,
                  session_date: r.session_date || r.check_in_at?.slice(0, 10) || "Unknown",
                  check_in_at: r.check_in_at || r.created_at || "",
                  status: (r.status || "PRESENT").toUpperCase(),
                };
              })
              .sort(
                (a: any, b: any) =>
                  new Date(b.check_in_at || b.session_date).getTime() -
                  new Date(a.check_in_at || a.session_date).getTime(),
              );

            // Fetch announcements across all lecturers (bounded to recent 50)
            const allNotices = await queryCollectionRest("announcements", { limit: 50 }).catch(() => []);
            const notices = allNotices
              .filter((n: any) => {
                if (n.course_id && enrolledCourseIds.includes(n.course_id)) return true;
                if (!n.course_id) {
                  if (!n.levels || n.levels.length === 0) return true;
                  if (n.levels.includes(String(level))) return true;
                }
                return false;
              })
              .map((n: any) => {
                const crs = n.course_id ? coursesMap.get(n.course_id) : null;
                const lecturerObj = n.owner_id ? usersMap.get(n.owner_id) : null;
                const lecturerName =
                  crs?.lecturer_name ||
                  lecturerObj?.full_name ||
                  lecturerObj?.email?.split("@")[0] ||
                  "Lecturer";

                return {
                  id: n.id,
                  title: n.title,
                  body: n.body,
                  course_id: n.course_id,
                  course_code: crs?.code || null,
                  course_title: crs?.title || null,
                  lecturer_name: lecturerName,
                  starts_on: n.starts_on || n.created_at || "",
                  created_at: n.created_at || "",
                };
              })
              .sort(
                (a: any, b: any) =>
                  new Date(b.created_at || b.starts_on || 0).getTime() -
                  new Date(a.created_at || a.starts_on || 0).getTime(),
              );

            // Fetch assignments across all lecturers for enrolled courses (bounded to recent 50)
            const allAssignments = await queryCollectionRest("assignments", { limit: 50 }).catch(() => []);
            const assignments = allAssignments
              .filter((a: any) => {
                if (a.course_id && enrolledCourseIds.includes(a.course_id)) return true;
                if (!a.course_id) {
                  if (!a.levels || a.levels.length === 0) return true;
                  if (a.levels.includes(String(level))) return true;
                }
                return false;
              })
              .map((a: any) => {
                const crs = a.course_id ? coursesMap.get(a.course_id) : null;
                const lecturerObj = a.owner_id ? usersMap.get(a.owner_id) : null;
                const lecturerName =
                  crs?.lecturer_name ||
                  lecturerObj?.full_name ||
                  lecturerObj?.email?.split("@")[0] ||
                  "Lecturer";

                return {
                  id: a.id,
                  title: a.title,
                  details: a.details,
                  course_id: a.course_id,
                  course_code: crs?.code || null,
                  course_title: crs?.title || null,
                  lecturer_name: lecturerName,
                  due_at: a.due_at || null,
                  submission_url: a.submission_url || null,
                  created_at: a.created_at || "",
                };
              })
              .sort((a: any, b: any) => {
                const now = Date.now();
                const dueA = a.due_at ? new Date(a.due_at).getTime() : Infinity;
                const dueB = b.due_at ? new Date(b.due_at).getTime() : Infinity;
                const overdueA = dueA < now;
                const overdueB = dueB < now;

                if (!overdueA && overdueB) return -1;
                if (overdueA && !overdueB) return 1;
                return dueA - dueB;
              });

            return Response.json({
              student: {
                id: studentId,
                full_name: fullName,
                index_number: cleanIndex,
                level: String(level),
                program,
                email: studentEmail,
                qr_uuid: qrUuid,
                lecturers_count: allStudentIds.length,
              },
              courses: enrichedCourses,
              announcements: notices,
              assignments,
              history,
            });
          }

          return Response.json({ error: "Invalid action" }, { status: 400 });
        } catch (err: any) {
          const errMsg = err?.message || String(err) || "Internal server error";
          if (isFirestoreQuotaError(500, errMsg)) {
            console.warn("[Student Auth] Temporary Firestore daily read quota exceeded:", errMsg);
            return Response.json(
              {
                error:
                  "Database free daily read quota reached. Limits reset daily at 00:00 UTC, or the project owner can upgrade billing in Firebase Console.",
                quotaExceeded: true,
                upgradeUrl:
                  "https://console.firebase.google.com/project/gen-lang-client-0546939058/firestore/databases/ai-studio-qrollapp-a10865e3-4f6f-44a2-a492-ba59ffef6658/data?openUpgradeDialog=true",
              },
              { status: 429 },
            );
          }

          console.error("Student auth error:", err);
          return Response.json({ error: errMsg }, { status: 500 });
        }
      },
    },
  },
});
