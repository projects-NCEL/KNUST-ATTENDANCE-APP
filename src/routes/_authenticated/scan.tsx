import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { firebaseAuth, firestoreDb } from "@/integrations/firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Camera,
  Square,
  AlertTriangle,
  RefreshCw,
  SwitchCamera,
  Lock,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

type Search = { session?: string };

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scanner — Qmark" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    session: typeof s.session === "string" ? s.session : undefined,
  }),
  component: ScanPage,
});

const QR_REGION_ID = "qr-reader";

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1050;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // audio is optional
  }
}

function ScanPage() {
  const { session: sessionId } = Route.useSearch();
  const qc = useQueryClient();
  const [activeSession, setActiveSession] = useState<string | undefined>(sessionId);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string>("Ready to scan");
  const [camError, setCamError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [manual, setManual] = useState("");
  const [lastScan, setLastScan] = useState<{ name: string; status: string } | null>(null);
  const [creatingQuick, setCreatingQuick] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const sessionRef = useRef<any>(null);
  const inFlight = useRef<Set<string>>(new Set());
  const recentScans = useRef<Map<string, number>>(new Map());

  const { user } = useAuth();
  const currentUid = user?.id || firebaseAuth.currentUser?.uid;

  // Open Sessions list
  const { data: openSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["open-sessions", currentUid],
    queryFn: async () => {
      if (!currentUid) return [];
      const [sessSnap, coursesSnap] = await Promise.all([
        getDocs(
          query(
            collection(firestoreDb, "attendance_sessions"),
            where("owner_id", "==", currentUid),
            where("status", "==", "OPEN"),
          ),
        ),
        getDocs(query(collection(firestoreDb, "courses"), where("owner_id", "==", currentUid))),
      ]);
      const courseMap = new Map(coursesSnap.docs.map((d) => [d.id, d.data() as any]));
      return sessSnap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          courses: data.course_id ? courseMap.get(data.course_id) : null,
        };
      });
    },
    enabled: !!currentUid,
  });

  // Current session details
  const { data: session } = useQuery({
    queryKey: ["session", activeSession],
    queryFn: async () => {
      if (!activeSession) return null;
      const sSnap = await getDoc(doc(firestoreDb, "attendance_sessions", activeSession));
      if (!sSnap.exists()) return null;
      const data = { id: sSnap.id, ...(sSnap.data() as any) };
      if (data.course_id) {
        try {
          const cSnap = await getDoc(doc(firestoreDb, "courses", data.course_id));
          if (cSnap.exists()) {
            const cData = cSnap.data() as any;
            data.courses = { code: cData.code, title: cData.title, level: cData.level };
          }
        } catch {
          // ignore
        }
      }
      return data;
    },
    enabled: !!activeSession,
  });

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Auto-select first open session if none selected
  useEffect(() => {
    if (!activeSession && openSessions && openSessions.length > 0) {
      setActiveSession(openSessions[0].id);
    }
  }, [activeSession, openSessions]);

  // Today's attendance records
  const { data: records } = useQuery({
    queryKey: ["records", activeSession, currentUid],
    queryFn: async () => {
      if (!activeSession || !currentUid) return [];
      const today = new Date().toISOString().slice(0, 10);
      const recSnap = await getDocs(
        query(
          collection(firestoreDb, "attendance_records"),
          where("session_id", "==", activeSession),
          where("session_date", "==", today),
        ),
      );
      const studentIds = Array.from(
        new Set(recSnap.docs.map((d) => (d.data() as any).student_id).filter(Boolean)),
      );
      const studentMap = new Map<string, any>();
      if (studentIds.length > 0) {
        // Universal lookup across students
        const sSnap = await getDocs(collection(firestoreDb, "students"));
        sSnap.docs.forEach((d) => {
          if (studentIds.includes(d.id)) {
            studentMap.set(d.id, d.data() as any);
          }
        });
      }
      const list = recSnap.docs.map((d) => {
        const data = d.data() as any;
        const st = studentMap.get(data.student_id);
        const fullName = data.student_name || st?.full_name || "Student";
        const indexNumber = data.index_number || st?.index_number || "";
        return {
          id: d.id,
          ...data,
          students: { full_name: fullName, index_number: indexNumber },
        };
      });
      return list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    },
    enabled: !!activeSession && !!currentUid,
    refetchInterval: 3000,
  });

  // Create Quick Session if none exists
  const handleCreateQuickSession = async () => {
    if (!currentUid) {
      toast.error("Please sign in first");
      return;
    }
    setCreatingQuick(true);
    try {
      // Find any existing course or use general
      const coursesSnap = await getDocs(
        query(collection(firestoreDb, "courses"), where("owner_id", "==", currentUid)),
      );
      const firstCourse = coursesSnap.docs[0];
      const now = new Date();
      const newSessionDoc = await addDoc(collection(firestoreDb, "attendance_sessions"), {
        owner_id: currentUid,
        title: `Quick Session - ${now.toLocaleDateString()}`,
        course_id: firstCourse ? firstCourse.id : null,
        status: "OPEN",
        mode: "single",
        starts_at: now.toISOString(),
        created_at: now.toISOString(),
      });
      toast.success("Quick attendance session started!");
      qc.invalidateQueries({ queryKey: ["open-sessions"] });
      setActiveSession(newSessionDoc.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create quick session");
    } finally {
      setCreatingQuick(false);
    }
  };

  // Process Scanned QR
  const processQr = async (rawInput: string): Promise<boolean> => {
    if (!rawInput) return false;
    let code = String(rawInput).trim();

    // 1. Clean JSON payloads
    try {
      if (code.startsWith("{") && code.endsWith("}")) {
        const parsed = JSON.parse(code);
        code =
          parsed.indexNumber ||
          parsed.index ||
          parsed.qrPayload ||
          parsed.qr ||
          parsed.token ||
          parsed.student_id ||
          parsed.id ||
          code;
      }
    } catch {
      // plain text
    }

    // 2. Clean URLs (e.g., https://.../student?index=2084931 or /pass/2084931)
    if (code.startsWith("http://") || code.startsWith("https://")) {
      try {
        const parsedUrl = new URL(code);
        const param =
          parsedUrl.searchParams.get("index") ||
          parsedUrl.searchParams.get("indexNumber") ||
          parsedUrl.searchParams.get("qr") ||
          parsedUrl.searchParams.get("id");
        if (param) {
          code = param;
        } else {
          const parts = parsedUrl.pathname.split("/").filter(Boolean);
          if (parts.length > 0) code = parts[parts.length - 1];
        }
      } catch {
        // ignore url parse error
      }
    }

    // 3. Strip common text prefixes & extraneous punctuation
    code = code
      .replace(/^["']|["']$/g, "")
      .replace(/^(STUDENT|INDEX|ID|PASS)[:\s-]+/i, "")
      .trim();

    const sess = sessionRef.current;
    if (!sess) {
      toast.error("No active session selected");
      return false;
    }

    // Debounce duplicate scans within 2.5s
    const now = Date.now();
    const lastTime = recentScans.current.get(code) ?? 0;
    if (now - lastTime < 2500) return false;
    recentScans.current.set(code, now);

    if (inFlight.current.has(code)) return false;
    inFlight.current.add(code);
    beep();

    try {
      setStatus(`Verifying ${code}…`);

      const cleanUpper = code.toUpperCase();
      const cleanLower = code.toLowerCase();
      const sanitizedUpper = cleanUpper.replace(/[^a-zA-Z0-9_-]/g, "_");

      let studentData: any = null;
      let studentId: string = "";

      // Strategy A: Direct document lookup by ID or stud_ prefix
      try {
        const directDoc1 = await getDoc(doc(firestoreDb, "students", `stud_${sanitizedUpper}`));
        if (directDoc1.exists()) {
          studentId = directDoc1.id;
          studentData = directDoc1.data();
        }
      } catch {
        /* ignore not found */
      }

      if (!studentData) {
        try {
          const directDoc2 = await getDoc(doc(firestoreDb, "students", code));
          if (directDoc2.exists()) {
            studentId = directDoc2.id;
            studentData = directDoc2.data();
          }
        } catch {
          /* ignore not found */
        }
      }

      // Strategy B: Query students collection by index_number
      if (!studentData) {
        const qSnap = await getDocs(
          query(collection(firestoreDb, "students"), where("index_number", "==", cleanUpper)),
        );
        if (!qSnap.empty) {
          studentId = qSnap.docs[0].id;
          studentData = qSnap.docs[0].data();
        }
      }

      // Strategy C: Query by qr_uuid
      if (!studentData) {
        const qrSnap = await getDocs(
          query(collection(firestoreDb, "students"), where("qr_uuid", "==", cleanLower)),
        );
        if (!qrSnap.empty) {
          studentId = qrSnap.docs[0].id;
          studentData = qrSnap.docs[0].data();
        }
      }

      // Strategy D: Search lecturer's student roster with case-insensitivity
      if (!studentData && currentUid) {
        const rosterSnap = await getDocs(
          query(collection(firestoreDb, "students"), where("owner_id", "==", currentUid)),
        );
        const match = rosterSnap.docs.find((d) => {
          const dt = d.data() as any;
          return (
            (dt.index_number && dt.index_number.toUpperCase() === cleanUpper) ||
            (dt.qr_uuid && dt.qr_uuid.toLowerCase() === cleanLower) ||
            d.id === code
          );
        });
        if (match) {
          studentId = match.id;
          studentData = match.data();
        }
      }

      // Strategy E: Fallback search in student_accounts to recover student metadata
      if (!studentData) {
        try {
          const accSnap = await getDoc(doc(firestoreDb, "student_accounts", sanitizedUpper));
          if (accSnap.exists()) {
            const accData = accSnap.data() as any;
            studentId = accData.student_id || `stud_${sanitizedUpper}`;
            studentData = {
              full_name: accData.full_name || `Student ${cleanUpper}`,
              index_number: cleanUpper,
              email: accData.email || "",
            };
          }
        } catch {
          /* ignore account fetch error */
        }
      }

      if (!studentData) {
        setStatus(`Unknown student: ${code}`);
        toast.error(`Unknown student code: ${code}`);
        setLastScan({ name: code, status: "NOT FOUND" });
        return false;
      }

      const resolvedName = studentData.full_name || `Student ${cleanUpper}`;
      const resolvedIndex = studentData.index_number || cleanUpper;
      const today = new Date().toISOString().slice(0, 10);

      // Check if already checked in today for this session
      const existingRecSnap = await getDocs(
        query(
          collection(firestoreDb, "attendance_records"),
          where("session_id", "==", sess.id),
          where("student_id", "==", studentId),
          where("session_date", "==", today),
        ),
      );

      if (!existingRecSnap.empty) {
        toast.info(`Already recorded: ${resolvedName}`);
        setLastScan({ name: resolvedName, status: "ALREADY RECORDED" });
        setStatus(`Already recorded: ${resolvedName}`);
        return true;
      }

      // Record attendance with full student metadata embedded for instant display
      await addDoc(collection(firestoreDb, "attendance_records"), {
        session_id: sess.id,
        student_id: studentId,
        student_name: resolvedName,
        index_number: resolvedIndex,
        session_date: today,
        check_in_at: new Date().toISOString(),
        status: "PRESENT",
        scanned_by: currentUid ?? null,
        owner_id: sess.owner_id || currentUid,
        created_at: new Date().toISOString(),
      });

      toast.success(`✓ Recorded: ${resolvedName} (${resolvedIndex})`);
      setLastScan({ name: resolvedName, status: "PRESENT" });
      setStatus(`✓ Recorded: ${resolvedName}`);
      qc.invalidateQueries({ queryKey: ["records", activeSession, currentUid] });
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to record scan");
      setStatus("Scan error");
      return false;
    } finally {
      inFlight.current.delete(code);
    }
  };

  const stopCamera = async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState?.();
        if (state === 2) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      }
    } catch {
      // ignore cleanup errors
    }
    scannerRef.current = null;
    setScanning(false);
    setStatus("Camera stopped");
  };

  const startCamera = async (preferredFacing?: "environment" | "user") => {
    let currentSess = activeSession;
    if (!currentSess) {
      if (openSessions && openSessions.length > 0) {
        currentSess = openSessions[0].id;
        setActiveSession(currentSess);
      } else {
        toast.info("Creating quick session to start scanning...");
        await handleCreateQuickSession();
        return;
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = "Camera access is not supported on this browser/connection.";
      setCamError(msg);
      toast.error(msg);
      return;
    }

    setCamError(null);
    setStatus("Opening camera…");

    try {
      await stopCamera();

      const container = document.getElementById(QR_REGION_ID);
      if (!container) throw new Error("Scanner container element not ready");

      const targetFacing = preferredFacing ?? facingMode;
      setFacingMode(targetFacing);

      scannerRef.current = new Html5Qrcode(QR_REGION_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
        ],
        verbose: false,
      });

      const qrConfig = {
        fps: 15,
        qrbox: (vw: number, vh: number) => {
          const minEdge = Math.min(vw, vh);
          const size = Math.max(220, Math.floor(minEdge * 0.76));
          return { width: Math.min(size, vw - 12), height: Math.min(size, vh - 12) };
        },
      };

      // Strategy 1: Check available camera hardware devices
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const rearCam = cameras.find((c) => /back|rear|environment/i.test(c.label));
          const frontCam = cameras.find((c) => /front|user|facetime/i.test(c.label));
          const chosen = (targetFacing === "environment" ? rearCam : frontCam) || cameras[0];
          await scannerRef.current.start(
            chosen.id,
            qrConfig,
            (decoded) => void processQr(decoded),
            () => {},
          );
          setScanning(true);
          setStatus("Camera active. Point student QR pass at camera.");
          return;
        }
      } catch {
        // Fall back to facingMode constraints
      }

      // Strategy 2: Ideal facingMode constraint
      try {
        await scannerRef.current.start(
          { facingMode: targetFacing },
          qrConfig,
          (decoded) => void processQr(decoded),
          () => {},
        );
        setScanning(true);
        setStatus("Camera active. Point student QR pass at camera.");
        return;
      } catch {
        // Strategy 3: Try user/front camera
        await scannerRef.current.start(
          { facingMode: "user" },
          qrConfig,
          (decoded) => void processQr(decoded),
          () => {},
        );
        setScanning(true);
        setStatus("Camera active. Point student QR pass at camera.");
      }
    } catch (err: any) {
      console.error("Camera startup failed:", err);
      const msg =
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in browser settings."
          : err?.name === "NotFoundError"
            ? "No camera found on this device."
            : err?.message || "Failed to start camera";
      setCamError(msg);
      toast.error(msg);
      setStatus("Camera error");
      setScanning(false);
    }
  };

  const flipCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    if (scanning) await startCamera(next);
  };

  const closeSession = async () => {
    if (!activeSession) return;
    if (!confirm("Close this attendance session?")) return;
    await stopCamera();
    try {
      await updateDoc(doc(firestoreDb, "attendance_sessions", activeSession), {
        status: "CLOSED",
        ends_at: new Date().toISOString(),
      });
      toast.success("Session closed");
      setActiveSession(undefined);
      qc.invalidateQueries({ queryKey: ["open-sessions"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to close session");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manual.trim()) {
      void processQr(manual.trim());
      setManual("");
    }
  };

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Attendance Scanner</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select an open session, start the camera, and scan student digital QR passes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Scanner Card */}
          <Card className="border border-border bg-card shadow-xs rounded-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">Class Session</CardTitle>
              {openSessions && openSessions.length === 0 && (
                <Button
                  size="sm"
                  onClick={handleCreateQuickSession}
                  disabled={creatingQuick}
                  className="h-7 text-xs font-bold gap-1 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>{creatingQuick ? "Creating..." : "Quick Session"}</span>
                </Button>
              )}
            </CardHeader>

            <CardContent className="space-y-3.5">
              {/* Session Picker */}
              <div className="space-y-1.5">
                <Select
                  value={activeSession ?? ""}
                  onValueChange={(val) => {
                    void stopCamera();
                    setActiveSession(val);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={sessionsLoading ? "Loading sessions..." : "Select an open session"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(openSessions ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.courses?.code ? `${s.courses.code} — ` : ""}
                        {s.title || "Session"} ({new Date(s.starts_at).toLocaleTimeString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {session && (
                <div className="p-2.5 rounded-lg border border-border bg-muted/40 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground">
                      {session.courses?.code || "Course"} {session.courses?.title ? `· ${session.courses.title}` : ""}
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      {session.title || "Open attendance session"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeSession}
                    className="h-7 text-[11px] font-semibold text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    <Lock className="size-3 mr-1" />
                    Close
                  </Button>
                </div>
              )}

              {/* Viewport for HTML5-QRCode */}
              <div
                id={QR_REGION_ID}
                className="w-full max-w-xs mx-auto rounded-xl overflow-hidden bg-black/95 relative border border-border"
                style={{ aspectRatio: "1 / 1", minHeight: 260 }}
              />

              {/* Status Indicator */}
              <div className="text-center text-xs text-muted-foreground">
                <span className={scanning ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""}>
                  {status}
                </span>
              </div>

              {/* Last Scan Feedback */}
              {lastScan && (
                <div className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-center">
                  <span className="font-bold text-foreground">{lastScan.name}</span> —{" "}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">{lastScan.status}</span>
                </div>
              )}

              {/* Error Message */}
              {camError && (
                <div className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{camError}</span>
                </div>
              )}

              {/* Camera Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                {!scanning ? (
                  <Button
                    onClick={() => void startCamera()}
                    className="flex-1 h-9 text-xs font-bold cursor-pointer"
                    disabled={!activeSession}
                  >
                    <Camera className="size-4 mr-1.5" />
                    Start Camera Scanner
                  </Button>
                ) : (
                  <Button
                    onClick={() => void stopCamera()}
                    variant="destructive"
                    className="flex-1 h-9 text-xs font-bold cursor-pointer"
                  >
                    <Square className="size-4 mr-1.5" />
                    Stop Camera
                  </Button>
                )}

                {scanning && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void flipCamera()}
                      title="Switch Camera (Front/Back)"
                      className="h-9 px-3 cursor-pointer"
                    >
                      <SwitchCamera className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void startCamera()}
                      title="Restart Camera"
                      className="h-9 px-3 cursor-pointer"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Manual Input Fallback */}
              <form onSubmit={handleManualSubmit} className="pt-3 border-t border-border flex gap-2">
                <Input
                  placeholder="Enter Student Index Number manually"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
                <Button type="submit" variant="outline" size="sm" className="h-9 text-xs font-bold cursor-pointer">
                  Check In
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Today's Scanned Records */}
          <Card className="border border-border bg-card shadow-xs rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Today's Verified Scans</span>
                <span className="text-xs font-normal text-muted-foreground">({records?.length ?? 0} students)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
                {(records ?? []).map((r: any) => (
                  <div key={r.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-foreground">{r.students?.full_name || "Student"}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{r.students?.index_number}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-xs gap-1">
                        <CheckCircle2 className="size-3.5" />
                        <span>PRESENT</span>
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                {!records?.length && (
                  <div className="p-10 text-center text-xs text-muted-foreground">
                    No scans recorded for this session yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
