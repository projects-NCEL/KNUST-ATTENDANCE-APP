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
  setDoc,
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
  ScanLine,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

type Search = { session?: string };

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Attendance Scanner — Qmark" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    session: typeof s.session === "string" ? s.session : undefined,
  }),
  component: ScanPage,
});

const QR_REGION_ID = "qr-reader";

// High quality audio chime for instant scan verification
function playScanSound(type: "success" | "duplicate" | "error" = "success") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "success") {
      // Pleasant double-beep high pitch
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === "duplicate") {
      // Gentle warning double note
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(440, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // Low buzz
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // audio is optional
  }
}

function triggerHaptic(type: "success" | "duplicate" | "error" = "success") {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (type === "success") {
        navigator.vibrate([100, 40, 100]);
      } else if (type === "duplicate") {
        navigator.vibrate([80, 40, 80]);
      } else {
        navigator.vibrate([200]);
      }
    }
  } catch {
    // Ignore haptic error
  }
}

function ScanPage() {
  const { session: sessionId } = Route.useSearch();
  const qc = useQueryClient();
  const [activeSession, setActiveSession] = useState<string | undefined>(sessionId);
  const [scanning, setScanning] = useState(false);
  const [isStartingCam, setIsStartingCam] = useState(false);
  const [status, setStatus] = useState<string>("Ready to scan student QR codes");
  const [camError, setCamError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [manual, setManual] = useState("");
  const [lastScan, setLastScan] = useState<{ name: string; status: string; time?: string } | null>(null);
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

  // Today's attendance records (no refetchInterval to eliminate distracting loading bars)
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
        try {
          const sSnap = await getDocs(collection(firestoreDb, "students"));
          sSnap.docs.forEach((d) => {
            if (studentIds.includes(d.id)) {
              studentMap.set(d.id, d.data() as any);
            }
          });
        } catch {
          // ignore
        }
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
  });

  // Create Quick Session if none exists
  const handleCreateQuickSession = async (): Promise<string | null> => {
    if (!currentUid) {
      toast.error("Please sign in first");
      return null;
    }
    setCreatingQuick(true);
    try {
      const coursesSnap = await getDocs(
        query(collection(firestoreDb, "courses"), where("owner_id", "==", currentUid)),
      );
      const firstCourse = coursesSnap.docs[0];
      const now = new Date();
      const newSessionDoc = await addDoc(collection(firestoreDb, "attendance_sessions"), {
        owner_id: currentUid,
        title: `Lecture Session — ${now.toLocaleDateString()}`,
        course_id: firstCourse ? firstCourse.id : null,
        status: "OPEN",
        mode: "single",
        starts_at: now.toISOString(),
        created_at: now.toISOString(),
      });
      toast.success("Attendance session created and ready for scanning!");
      qc.invalidateQueries({ queryKey: ["open-sessions"] });
      setActiveSession(newSessionDoc.id);
      return newSessionDoc.id;
    } catch (err: any) {
      toast.error(err?.message || "Failed to create quick session");
      return null;
    } finally {
      setCreatingQuick(false);
    }
  };

  // Process Scanned QR code with deep resilient decoding & auto-provisioning
  const processQr = async (rawInput: string): Promise<boolean> => {
    if (!rawInput) return false;
    let code = String(rawInput).trim();

    // 1. Unpack JSON payloads (e.g., student pass object)
    try {
      if ((code.startsWith("{") && code.endsWith("}")) || (code.startsWith("[") && code.endsWith("]"))) {
        const parsed = JSON.parse(code);
        code =
          parsed.indexNumber ||
          parsed.index_number ||
          parsed.index ||
          parsed.qrPayload ||
          parsed.qr_uuid ||
          parsed.qr ||
          parsed.token ||
          parsed.student_id ||
          parsed.id ||
          code;
      }
    } catch {
      // plain string
    }

    // 2. Unpack URLs (e.g. /student?index=4076024 or /check-in?token=...)
    if (code.startsWith("http://") || code.startsWith("https://")) {
      try {
        const parsedUrl = new URL(code);
        const param =
          parsedUrl.searchParams.get("index") ||
          parsedUrl.searchParams.get("indexNumber") ||
          parsedUrl.searchParams.get("index_number") ||
          parsedUrl.searchParams.get("qr") ||
          parsedUrl.searchParams.get("token") ||
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

    // 3. Clean string prefixes, quotation marks and trailing punctuation
    code = String(code)
      .replace(/^["']|["']$/g, "")
      .replace(/^(STUDENT|INDEX|ID|PASS)[:\s-]+/i, "")
      .trim();

    if (!code) return false;

    // Resolve target session
    let sess = sessionRef.current;
    if (!sess) {
      if (activeSession) {
        sess = openSessions?.find((s: any) => s.id === activeSession) || { id: activeSession, owner_id: currentUid };
      } else if (openSessions && openSessions.length > 0) {
        sess = openSessions[0];
        setActiveSession(sess.id);
      }
    }

    if (!sess) {
      toast.error("Please select or create an active class session first.");
      return false;
    }

    // Debounce duplicate scans within 2 seconds
    const now = Date.now();
    const lastTime = recentScans.current.get(code) ?? 0;
    if (now - lastTime < 2000) return false;
    recentScans.current.set(code, now);

    if (inFlight.current.has(code)) return false;
    inFlight.current.add(code);

    try {
      setStatus(`Scanning: ${code}…`);

      const cleanUpper = code.toUpperCase();
      const cleanLower = code.toLowerCase();
      const sanitizedUpper = cleanUpper.replace(/[^a-zA-Z0-9_-]/g, "_");

      let studentData: any = null;
      let studentId: string = "";

      // 1. Lookup in students collection by index_number (Exact & Case-Insensitive)
      try {
        const qSnap = await getDocs(
          query(collection(firestoreDb, "students"), where("index_number", "==", cleanUpper)),
        );
        if (!qSnap.empty) {
          studentId = qSnap.docs[0].id;
          studentData = qSnap.docs[0].data();
        }
      } catch {
        // continue
      }

      // 2. Direct document ID lookup (e.g. stud_4076024 or raw ID)
      if (!studentData) {
        try {
          const directDoc1 = await getDoc(doc(firestoreDb, "students", `stud_${sanitizedUpper}`));
          if (directDoc1.exists()) {
            studentId = directDoc1.id;
            studentData = directDoc1.data();
          }
        } catch {
          // continue
        }
      }

      if (!studentData) {
        try {
          const directDoc2 = await getDoc(doc(firestoreDb, "students", code));
          if (directDoc2.exists()) {
            studentId = directDoc2.id;
            studentData = directDoc2.data();
          }
        } catch {
          // continue
        }
      }

      // 3. Lookup by qr_uuid
      if (!studentData) {
        try {
          const qrSnap = await getDocs(
            query(collection(firestoreDb, "students"), where("qr_uuid", "==", cleanLower)),
          );
          if (!qrSnap.empty) {
            studentId = qrSnap.docs[0].id;
            studentData = qrSnap.docs[0].data();
          }
        } catch {
          // continue
        }
      }

      // 4. Fallback search across lecturer's roster
      if (!studentData && currentUid) {
        try {
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
        } catch {
          // continue
        }
      }

      // 5. Fallback search in student_accounts collection
      if (!studentData) {
        try {
          const accSnap = await getDoc(doc(firestoreDb, "student_accounts", sanitizedUpper));
          if (accSnap.exists()) {
            const accData = accSnap.data() as any;
            studentId = accData.student_id || `stud_${sanitizedUpper}`;
            studentData = {
              full_name: accData.full_name || `Student (${cleanUpper})`,
              index_number: cleanUpper,
              email: accData.email || "",
            };
          }
        } catch {
          // continue
        }
      }

      // 6. AUTO-PROVISION IF NOT FOUND:
      // Never fail attendance for a valid student index number!
      if (!studentData) {
        const autoDocId = `stud_${sanitizedUpper}`;
        studentId = autoDocId;
        studentData = {
          full_name: `Student (${cleanUpper})`,
          index_number: cleanUpper,
          owner_id: sess.owner_id || currentUid || "universal",
          created_at: new Date().toISOString(),
        };
        try {
          await setDoc(doc(firestoreDb, "students", autoDocId), studentData, { merge: true });
        } catch {
          // continue
        }
      }

      const resolvedName = studentData.full_name || `Student (${cleanUpper})`;
      const resolvedIndex = studentData.index_number || cleanUpper;
      const today = new Date().toISOString().slice(0, 10);

      // Check if already checked in today for this session
      const existingRecSnap = await getDocs(
        query(
          collection(firestoreDb, "attendance_records"),
          where("session_id", "==", sess.id),
          where("session_date", "==", today),
        ),
      );

      const alreadyRecorded = existingRecSnap.docs.some((d) => {
        const dt = d.data() as any;
        return (
          dt.student_id === studentId ||
          (dt.index_number && dt.index_number.toUpperCase() === resolvedIndex.toUpperCase())
        );
      });

      const nowTimeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      if (alreadyRecorded) {
        playScanSound("duplicate");
        triggerHaptic("duplicate");
        toast.info(`Already recorded: ${resolvedName} (${resolvedIndex})`);
        setLastScan({ name: `${resolvedName} (${resolvedIndex})`, status: "ALREADY RECORDED", time: nowTimeStr });
        setStatus(`Already recorded: ${resolvedName}`);
        return true;
      }

      // Record attendance with full student metadata embedded for instant real-time display
      await addDoc(collection(firestoreDb, "attendance_records"), {
        session_id: sess.id,
        course_id: sess.course_id || null,
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

      // Instant high quality audio & haptic feedback
      playScanSound("success");
      triggerHaptic("success");

      toast.success(`✓ Recorded: ${resolvedName} (${resolvedIndex})`);
      setLastScan({ name: `${resolvedName} (${resolvedIndex})`, status: "PRESENT", time: nowTimeStr });
      setStatus(`✓ Recorded: ${resolvedName}`);

      // Refresh records immediately
      qc.invalidateQueries({ queryKey: ["records", sess.id, currentUid] });
      return true;
    } catch (err: any) {
      console.error("Scan processing error:", err);
      playScanSound("error");
      triggerHaptic("error");
      toast.error(err?.message || "Failed to record scan");
      setStatus("Scan error. Please try again.");
      return false;
    } finally {
      inFlight.current.delete(code);
    }
  };

  const stopCamera = async () => {
    try {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch (stopErr) {
          console.warn("scanner.stop error:", stopErr);
        }
        try {
          await scannerRef.current.clear();
        } catch (clearErr) {
          console.warn("scanner.clear error:", clearErr);
        }
      }
    } catch {
      // ignore cleanup errors
    }
    scannerRef.current = null;
    const container = document.getElementById(QR_REGION_ID);
    if (container) container.innerHTML = "";
    setScanning(false);
    setStatus("Camera stopped. Ready to scan.");
  };

  const startCamera = async (preferredFacing?: "environment" | "user", overrideCamId?: string) => {
    let currentSess = activeSession;
    if (!currentSess) {
      if (openSessions && openSessions.length > 0) {
        currentSess = openSessions[0].id;
        setActiveSession(currentSess);
      } else {
        toast.info("Setting up attendance session to start camera...");
        const newId = await handleCreateQuickSession();
        if (!newId) {
          setIsStartingCam(false);
          return;
        }
        currentSess = newId;
      }
    }

    if (typeof window !== "undefined" && window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      const msg = "Camera access requires HTTPS or localhost. Please ensure you are connected securely.";
      setCamError(msg);
      toast.error(msg);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Camera access is not supported on this browser or connection (HTTPS required).";
      setCamError(msg);
      toast.error(msg);
      return;
    }

    setCamError(null);
    setIsStartingCam(true);
    setStatus("Opening camera…");

    try {
      await stopCamera();

      const container = document.getElementById(QR_REGION_ID);
      if (!container) throw new Error("Scanner container element not ready");
      container.innerHTML = "";

      const targetFacing = preferredFacing ?? facingMode;
      setFacingMode(targetFacing);

      // Probe cameras for label enumeration if available
      let cams: Array<{ id: string; label: string }> = [];
      try {
        cams = await Html5Qrcode.getCameras();
      } catch {
        // ignore probe failure, will try getUserMedia
      }

      if (!cams || cams.length === 0 || !cams[0].label) {
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
          testStream.getTracks().forEach((t) => t.stop());
          cams = await Html5Qrcode.getCameras();
        } catch (probeErr: any) {
          console.warn("Camera probe warning:", probeErr);
        }
      }

      if (cams && cams.length > 0) {
        setAvailableCameras(cams);
      }

      // Determine camera ID to use if user explicitly selected or we have devices
      let chosenCamId: string | null =
        overrideCamId ||
        (cams && cams.length > 0 ? (selectedCameraId && cams.some((c) => c.id === selectedCameraId) ? selectedCameraId : null) : null);

      if (!chosenCamId && cams && cams.length > 0) {
        if (targetFacing === "environment") {
          const rear = cams.find((c) => /back|rear|environment|main/i.test(c.label));
          chosenCamId = rear ? rear.id : cams[0].id;
        } else {
          const front = cams.find((c) => /front|user|facetime|webcam|integrated/i.test(c.label));
          chosenCamId = front ? front.id : cams[0].id;
        }
      }

      if (chosenCamId) {
        setSelectedCameraId(chosenCamId);
      }

      // QR box configuration without rigid aspectRatio constraint to prevent OverconstrainedError on webcams
      const qrConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edge = Math.floor(minEdge * 0.85);
          return {
            width: Math.max(200, edge),
            height: Math.max(200, edge),
          };
        },
      };

      // Create fresh Html5Qrcode instance
      const html5Qr = new Html5Qrcode(QR_REGION_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = html5Qr;

      let started = false;
      let lastStartError: any = null;

      // Strategy 1: specific camera ID if chosen
      if (chosenCamId) {
        try {
          await html5Qr.start(
            chosenCamId,
            qrConfig,
            (decoded) => void processQr(decoded),
            () => {},
          );
          started = true;
        } catch (err1) {
          console.warn("Start with chosenCamId failed, falling back to facingMode:", err1);
          lastStartError = err1;
        }
      }

      // Strategy 2: target facingMode (environment / back camera or user)
      if (!started) {
        try {
          await html5Qr.start(
            { facingMode: targetFacing },
            qrConfig,
            (decoded) => void processQr(decoded),
            () => {},
          );
          started = true;
        } catch (err2) {
          console.warn(`Start with facingMode ${targetFacing} failed:`, err2);
          lastStartError = err2;
        }
      }

      // Strategy 3: alternate facingMode (e.g. user-facing for laptops when back camera doesn't exist)
      if (!started) {
        const alternateFacing = targetFacing === "environment" ? "user" : "environment";
        try {
          await html5Qr.start(
            { facingMode: alternateFacing },
            qrConfig,
            (decoded) => void processQr(decoded),
            () => {},
          );
          started = true;
          setFacingMode(alternateFacing);
        } catch (err3) {
          console.warn(`Start with alternate facingMode ${alternateFacing} failed:`, err3);
          lastStartError = err3;
        }
      }

      // Strategy 4: universal video constraint (bypasses facingMode completely)
      if (!started) {
        try {
          await html5Qr.start(
            { facingMode: undefined } as any,
            qrConfig,
            (decoded) => void processQr(decoded),
            () => {},
          );
          started = true;
        } catch (err4) {
          console.warn("Start with generic video config failed:", err4);
          lastStartError = err4;
        }
      }

      if (!started) {
        throw lastStartError || new Error("Could not initialize video feed from any camera device");
      }

      setScanning(true);
      setStatus("Camera active. Point student QR code at camera.");
      setCamError(null);
    } catch (err: any) {
      console.error("All camera start attempts failed:", err);
      const msg =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
          ? "Camera permission denied. Please allow camera permissions in your browser address bar."
          : err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError"
            ? "No camera device detected on this device."
            : err?.name === "NotReadableError" || err?.name === "TrackStartError"
              ? "Camera is currently busy in another tab or application. Please close other camera apps and retry."
              : err?.name === "OverconstrainedError"
                ? "Camera settings not supported by hardware. Retrying with basic settings..."
                : err?.message || "Failed to start camera";
      setCamError(msg);
      toast.error(msg);
      setStatus("Camera error");
      setScanning(false);
    } finally {
      setIsStartingCam(false);
    }
  };

  const flipCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    setSelectedCameraId("");
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
      {/* CSS to ensure video fits viewport without aspect-ratio distortion */}
      <style>{`
        #qr-reader {
          border: none !important;
          background: #000 !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1rem !important;
        }
        #qr-reader __scan_region__ {
          border: 2px solid #D4AF37 !important;
          border-radius: 0.75rem !important;
        }
      `}</style>

      {/* Main container: covers almost entire screen width on desktop/laptop */}
      <div className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/50">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <ScanLine className="size-7 text-[#D4AF37]" />
              <span>Attendance Scanner</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Instant hardware-accelerated QR code scanner for student attendance verification.
            </p>
          </div>
          {openSessions && openSessions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {openSessions.length} Active {openSessions.length === 1 ? "Session" : "Sessions"}
              </span>
            </div>
          )}
        </div>

        {/* 12-Column Responsive Layout: Wide layout on desktop/laptop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* Scanner Card: Spans 7 columns on desktop for large, comfortable scanning */}
          <Card className="lg:col-span-7 xl:col-span-7 border-2 border-[#D4AF37]/40 shadow-md bg-card rounded-2xl overflow-hidden flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span>Scanner Viewport</span>
                {scanning && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                    LIVE CAMERA
                  </span>
                )}
              </CardTitle>
              {openSessions && openSessions.length === 0 && (
                <Button
                  size="sm"
                  onClick={handleCreateQuickSession}
                  disabled={creatingQuick}
                  className="h-8 text-xs font-bold gap-1.5 cursor-pointer bg-[#0A1F44] text-white hover:bg-[#0A1F44]/90 dark:bg-white dark:text-[#0A1F44]"
                >
                  <Plus className="size-3.5" />
                  <span>{creatingQuick ? "Creating..." : "Start Quick Session"}</span>
                </Button>
              )}
            </CardHeader>

            <CardContent className="space-y-4 pt-4 flex-1">
              {/* Session Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Target Course Session
                </label>
                <Select
                  value={activeSession ?? ""}
                  onValueChange={(val) => {
                    void stopCamera();
                    setActiveSession(val);
                  }}
                >
                  <SelectTrigger className="h-10 text-xs font-medium">
                    <SelectValue placeholder="Select an open session to record attendance" />
                  </SelectTrigger>
                  <SelectContent>
                    {(openSessions ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs font-medium">
                        {s.courses?.code ? `${s.courses.code} — ` : ""}
                        {s.title || "Session"} ({new Date(s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {session && (
                <div className="p-3 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/5 dark:bg-[#D4AF37]/10 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-foreground text-sm">
                      {session.courses?.code || "Course"} {session.courses?.title ? `· ${session.courses.title}` : ""}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {session.title || "Open attendance session"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeSession}
                    className="h-8 text-[11px] font-bold text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    <Lock className="size-3 mr-1" />
                    Close Session
                  </Button>
                </div>
              )}

              {/* Camera Device Selector if multiple cameras exist */}
              {availableCameras.length > 1 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Selected Camera Device
                  </label>
                  <Select
                    value={selectedCameraId}
                    onValueChange={(camId) => {
                      setSelectedCameraId(camId);
                      if (scanning) {
                        void startCamera(facingMode, camId);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Choose camera device" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCameras.map((cam, idx) => (
                        <SelectItem key={cam.id} value={cam.id} className="text-xs">
                          {cam.label || `Camera ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Viewport for HTML5-QRCode: Generously sized for desktop/laptop screens */}
              <div className="relative w-full flex justify-center py-2">
                <div
                  className="w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl mx-auto rounded-2xl overflow-hidden bg-black relative border-2 border-[#D4AF37]/50 shadow-lg min-h-[300px] flex items-center justify-center"
                  style={{ minHeight: "300px" }}
                >
                  {/* HTML5-QRCode mounts directly into this div. NO React children are rendered inside so React reconciler never destroys video nodes */}
                  <div id={QR_REGION_ID} className="w-full h-full min-h-[300px]" />

                  {/* Overlays rendered by React as absolute siblings over the video container */}
                  {!scanning && !isStartingCam && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/80 select-none bg-black/80 z-10 pointer-events-none">
                      <div className="size-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-[#D4AF37] mb-3">
                        <Camera className="size-8" />
                      </div>
                      <p className="text-sm font-bold text-white">Camera Viewfinder</p>
                      <p className="text-xs text-white/70 max-w-xs mt-1">
                        Click "Start Camera Scanner" below. Works on laptop webcams, smartphones, and USB cameras.
                      </p>
                    </div>
                  )}

                  {isStartingCam && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white select-none bg-black/85 z-10 pointer-events-none">
                      <RefreshCw className="size-8 text-[#D4AF37] animate-spin mb-3" />
                      <p className="text-xs font-bold tracking-wide uppercase">Initializing camera hardware...</p>
                      <p className="text-[11px] text-white/70 mt-1">Configuring video stream and barcode detector</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="text-center text-xs">
                <span className={scanning ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground font-medium"}>
                  {status}
                </span>
              </div>

              {/* Last Scan Feedback */}
              {lastScan && (
                <div className="p-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 text-xs flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <p className="font-bold text-foreground text-sm leading-tight">{lastScan.name}</p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">{lastScan.status}</p>
                    </div>
                  </div>
                  {lastScan.time && (
                    <span className="text-[10px] text-muted-foreground font-mono">{lastScan.time}</span>
                  )}
                </div>
              )}

              {/* Error Message */}
              {camError && (
                <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-xs space-y-1">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span className="font-bold">Camera Notice</span>
                  </div>
                  <p className="text-[11px] pl-6">{camError}</p>
                </div>
              )}

              {/* Camera Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                {!scanning ? (
                  <Button
                    onClick={() => void startCamera()}
                    className="flex-1 h-11 text-xs font-bold cursor-pointer bg-[#0A1F44] text-white hover:bg-[#0A1F44]/90 dark:bg-white dark:text-[#0A1F44] border-2 border-[#D4AF37]/60 shadow-md"
                    disabled={isStartingCam}
                  >
                    {isStartingCam ? (
                      <>
                        <RefreshCw className="size-4 mr-2 animate-spin" />
                        Initializing Camera...
                      </>
                    ) : (
                      <>
                        <Camera className="size-4 mr-2" />
                        Start Camera Scanner
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => void stopCamera()}
                    variant="destructive"
                    className="flex-1 h-11 text-xs font-bold cursor-pointer shadow-md"
                  >
                    <Square className="size-4 mr-2" />
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
                      className="h-11 px-4 cursor-pointer border-2 border-[#D4AF37]/40"
                    >
                      <SwitchCamera className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void startCamera()}
                      title="Restart Camera"
                      className="h-11 px-4 cursor-pointer border-2 border-[#D4AF37]/40"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Manual Input Fallback */}
              <form onSubmit={handleManualSubmit} className="pt-3 border-t border-border flex gap-2">
                <Input
                  placeholder="Enter Student Index Number (e.g. 4076024)"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  className="h-10 text-xs font-mono"
                />
                <Button type="submit" variant="outline" size="sm" className="h-10 text-xs font-bold cursor-pointer border-2 border-[#D4AF37]/50">
                  <UserCheck className="size-4 mr-1.5" />
                  Check In
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Today's Scanned Records: Spans 5 columns on desktop */}
          <Card className="lg:col-span-5 xl:col-span-5 border-2 border-border shadow-md bg-card rounded-2xl overflow-hidden flex flex-col">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>Verified Scans Today</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#0A1F44]/10 dark:bg-white/10 text-foreground">
                  {records?.length ?? 0} Students
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <div className="divide-y divide-border/60 max-h-[640px] overflow-y-auto">
                {(records ?? []).map((r: any) => (
                  <div key={r.id} className="p-3.5 px-4 flex items-center justify-between text-xs hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="font-extrabold text-foreground text-sm">{r.students?.full_name || "Student"}</p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{r.students?.index_number}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-xs gap-1">
                        <CheckCircle2 className="size-3.5" />
                        <span>PRESENT</span>
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(r.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                {!records?.length && (
                  <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
                    <p className="font-bold text-foreground">No scans recorded yet</p>
                    <p>Start the camera and point a student QR pass, or enter their index number above.</p>
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
