import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
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
  onSnapshot,
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
  UserCheck,
  Upload,
  Image as ImageIcon,
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

// Audio chime for immediate feedback
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
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === "duplicate") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(440, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // Audio optional
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
    // Haptics optional
  }
}

/**
 * High-speed multi-pass QR decoder helper:
 * 1. Checks native BarcodeDetector if available
 * 2. Checks standard jsQR
 * 3. Runs contrast-enhanced binarization pass for low-contrast/gold/dim QR codes
 */
async function decodeImageToQr(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  barcodeDetectorInstance: any | null,
): Promise<string | null> {
  // 1. Try native hardware BarcodeDetector if available
  if (barcodeDetectorInstance) {
    try {
      const results = await barcodeDetectorInstance.detect(source);
      if (results && results.length > 0 && results[0]?.rawValue) {
        return results[0].rawValue;
      }
    } catch {
      // Fallback to jsQR
    }
  }

  // 2. Prepare off-screen canvas (scale down to max 640 for rapid sub-millisecond processing)
  const srcWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const srcHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!srcWidth || !srcHeight) return null;

  const maxDimension = 640;
  let targetW = srcWidth;
  let targetH = srcHeight;
  if (targetW > maxDimension || targetH > maxDimension) {
    const scale = Math.min(maxDimension / targetW, maxDimension / targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, targetW, targetH);
  const imgData = ctx.getImageData(0, 0, targetW, targetH);

  // 3. Try standard jsQR pass
  try {
    const directResult = jsQR(imgData.data, targetW, targetH, {
      inversionAttempts: "attemptBoth",
    });
    if (directResult && directResult.data) {
      return directResult.data;
    }
  } catch {
    // continue to enhanced pass
  }

  // 4. Try contrast-enhanced binarization pass
  // Detects gold-on-white, washed out, low-contrast, or dim screen QR codes
  try {
    const data = imgData.data;
    const enhanced = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Perceptual luminance calculation
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // High-contrast cutoff threshold
      const val = lum < 225 ? 0 : 255;
      enhanced[i] = val;
      enhanced[i + 1] = val;
      enhanced[i + 2] = val;
      enhanced[i + 3] = 255;
    }
    const enhancedResult = jsQR(enhanced, targetW, targetH, {
      inversionAttempts: "attemptBoth",
    });
    if (enhancedResult && enhancedResult.data) {
      return enhancedResult.data;
    }
  } catch {
    // ignore
  }

  return null;
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
  const [scanPulse, setScanPulse] = useState(false);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);

  // Direct React-managed video & stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDecodingRef = useRef(false);
  const barcodeDetectorRef = useRef<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sessionRef = useRef<any>(null);
  const activeSessionRef = useRef<string | undefined>(sessionId);
  const inFlight = useRef<Set<string>>(new Set());
  const recentScans = useRef<Map<string, number>>(new Map());
  const studentRosterCache = useRef<Map<string, any>>(new Map());
  const scannedRecordsSet = useRef<Set<string>>(new Set());

  const { user } = useAuth();
  const currentUid = user?.id || firebaseAuth.currentUser?.uid;

  // Initialize native BarcodeDetector if available in browser
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ["qr_code", "code_128", "data_matrix"],
        });
      }
    } catch {
      barcodeDetectorRef.current = null;
    }
  }, []);

  useEffect(() => {
    activeSessionRef.current = activeSession;
    scannedRecordsSet.current = new Set();
  }, [activeSession]);

  // Pre-load student roster in-memory cache for instant sub-millisecond lookups
  useEffect(() => {
    let active = true;
    getDocs(collection(firestoreDb, "students"))
      .then((snap) => {
        if (!active) return;
        const cache = new Map<string, any>();
        snap.docs.forEach((d) => {
          const dt = { id: d.id, ...d.data() } as any;
          cache.set(d.id.toUpperCase(), dt);
          cache.set(d.id.toLowerCase(), dt);
          const rawId = d.id.replace(/^stud_/i, "").toUpperCase();
          cache.set(rawId, dt);
          if (dt.index_number) {
            const rawIdx = String(dt.index_number).trim();
            cache.set(rawIdx.toUpperCase(), dt);
            cache.set(rawIdx.toLowerCase(), dt);
            cache.set(rawIdx.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(), dt);
          }
          if (dt.student_id) {
            const sId = String(dt.student_id).trim();
            cache.set(sId.toUpperCase(), dt);
            cache.set(sId.toLowerCase(), dt);
          }
          if (dt.qr_uuid) {
            cache.set(String(dt.qr_uuid).trim().toLowerCase(), dt);
            cache.set(String(dt.qr_uuid).trim().toUpperCase(), dt);
          }
        });
        studentRosterCache.current = cache;
      })
      .catch((err) => {
        console.warn("Roster cache preload warning:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Open Sessions list
  const { data: openSessions } = useQuery({
    queryKey: ["open-sessions", currentUid],
    queryFn: async () => {
      if (!currentUid) return [];
      const [sessSnap, coursesSnap] = await Promise.all([
        getDocs(
          query(
            collection(firestoreDb, "attendance_sessions"),
            where("status", "==", "OPEN"),
          ),
        ),
        getDocs(collection(firestoreDb, "courses")),
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

  // Real-time Firestore onSnapshot for Attendance Records in the Active Session
  useEffect(() => {
    if (!activeSession) {
      setRecentRecords([]);
      return;
    }

    const q = query(
      collection(firestoreDb, "attendance_records"),
      where("session_id", "==", activeSession),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

        // Format and map student names
        const formatted = list.map((item) => {
          const cached =
            studentRosterCache.current.get(item.student_id?.toUpperCase()) ||
            studentRosterCache.current.get(item.index_number?.toUpperCase()) ||
            studentRosterCache.current.get(item.index_number);
          const fullName = item.student_name || cached?.full_name || "Student";
          const indexNum = item.index_number || cached?.index_number || "";
          return {
            ...item,
            students: {
              full_name: fullName,
              index_number: indexNum,
            },
          };
        });

        setRecentRecords(formatted);

        // Update in-memory scanned set to prevent duplicate alerts
        const set = new Set<string>();
        formatted.forEach((r: any) => {
          if (r.student_id) set.add(String(r.student_id).toUpperCase());
          if (r.index_number) set.add(String(r.index_number).toUpperCase());
          if (r.students?.index_number) set.add(String(r.students.index_number).toUpperCase());
        });
        scannedRecordsSet.current = set;
      },
      (err) => {
        console.warn("Attendance onSnapshot warning:", err);
      },
    );

    return () => unsubscribe();
  }, [activeSession]);

  // Create Quick Session if none exists
  const handleCreateQuickSession = useCallback(async (): Promise<string | null> => {
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
      activeSessionRef.current = newSessionDoc.id;
      return newSessionDoc.id;
    } catch (err: any) {
      toast.error(err?.message || "Failed to create quick session");
      return null;
    } finally {
      setCreatingQuick(false);
    }
  }, [currentUid, qc]);

  // Process Scanned QR code with instant zero-latency feedback & non-blocking background persistence
  const processQr = useCallback(async (rawInput: string): Promise<boolean> => {
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
      const currentActiveId = activeSessionRef.current || activeSession;
      if (currentActiveId) {
        sess = openSessions?.find((s: any) => s.id === currentActiveId) || {
          id: currentActiveId,
          owner_id: currentUid,
        };
      } else if (openSessions && openSessions.length > 0) {
        sess = openSessions[0];
        setActiveSession(sess.id);
        activeSessionRef.current = sess.id;
      }
    }

    if (!sess) {
      const autoId = await handleCreateQuickSession();
      if (autoId) {
        sess = { id: autoId, owner_id: currentUid };
        activeSessionRef.current = autoId;
      } else {
        toast.error("Please select or create an active class session first.");
        return false;
      }
    }

    // Debounce duplicate scans within 1.0 second for rapid queue processing
    const now = Date.now();
    const lastTime = recentScans.current.get(code) ?? 0;
    if (now - lastTime < 1000) return false;
    recentScans.current.set(code, now);

    if (inFlight.current.has(code)) return false;
    inFlight.current.add(code);

    try {
      const cleanUpper = code.toUpperCase();
      const cleanLower = code.toLowerCase();
      const sanitizedUpper = cleanUpper.replace(/[^a-zA-Z0-9_-]/g, "_");
      const today = new Date().toISOString().slice(0, 10);
      const nowTimeStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      // 1. Instant check if already recorded in active session from in-memory set (0ms response)
      if (
        scannedRecordsSet.current.has(cleanUpper) ||
        scannedRecordsSet.current.has(code) ||
        scannedRecordsSet.current.has(`STUD_${sanitizedUpper}`) ||
        scannedRecordsSet.current.has(cleanLower)
      ) {
        playScanSound("duplicate");
        triggerHaptic("duplicate");
        const cached =
          studentRosterCache.current.get(cleanUpper) ||
          studentRosterCache.current.get(code) ||
          studentRosterCache.current.get(`STUD_${sanitizedUpper}`);
        const dupName = cached?.full_name || `Student (${cleanUpper})`;
        toast.info(`Already recorded: ${dupName} (${cleanUpper})`);
        setLastScan({
          name: `${dupName} (${cleanUpper})`,
          status: "ALREADY RECORDED",
          time: nowTimeStr,
        });
        setStatus(`Already recorded: ${dupName}`);
        return true;
      }

      // 2. Synchronous student resolution from in-memory cache (<0.01ms lookup)
      let studentData: any =
        studentRosterCache.current.get(cleanUpper) ||
        studentRosterCache.current.get(cleanLower) ||
        studentRosterCache.current.get(code) ||
        studentRosterCache.current.get(`STUD_${sanitizedUpper}`) ||
        studentRosterCache.current.get(cleanUpper.replace(/[^a-zA-Z0-9]/g, ""));

      let studentId: string = studentData?.id || `stud_${sanitizedUpper}`;
      const resolvedName = studentData?.full_name || `Student (${cleanUpper})`;
      const resolvedIndex = studentData?.index_number || cleanUpper;

      // 3. Mark in-memory set IMMEDIATELY (<1ms) to eliminate duplicate race conditions
      scannedRecordsSet.current.add(cleanUpper);
      scannedRecordsSet.current.add(cleanLower);
      scannedRecordsSet.current.add(code);
      scannedRecordsSet.current.add(`STUD_${sanitizedUpper}`);
      if (studentId) scannedRecordsSet.current.add(studentId.toUpperCase());
      scannedRecordsSet.current.add(resolvedIndex.toUpperCase());

      // 4. ZERO-LATENCY USER FEEDBACK (<2ms): Instant audio chime, haptics, viewfinder pulse, and toast
      playScanSound("success");
      triggerHaptic("success");
      setScanPulse(true);
      setTimeout(() => setScanPulse(false), 500);
      toast.success(`✓ Recorded: ${resolvedName} (${resolvedIndex})`);
      setLastScan({
        name: `${resolvedName} (${resolvedIndex})`,
        status: "PRESENT",
        time: nowTimeStr,
      });
      setStatus(`✓ Recorded: ${resolvedName}`);

      // 5. Asynchronous persistence & roster refinement in background without blocking video stream
      (async () => {
        try {
          if (!studentData) {
            try {
              const [directSnap, qSnap, uuidSnap] = await Promise.all([
                getDoc(doc(firestoreDb, "students", `stud_${sanitizedUpper}`)).catch(() => null),
                getDocs(
                  query(
                    collection(firestoreDb, "students"),
                    where("index_number", "==", cleanUpper),
                  ),
                ).catch(() => null),
                getDocs(
                  query(collection(firestoreDb, "students"), where("qr_uuid", "==", code)),
                ).catch(() => null),
              ]);
              if (directSnap && directSnap.exists()) {
                studentId = directSnap.id;
                studentData = directSnap.data();
                studentRosterCache.current.set(cleanUpper, { id: directSnap.id, ...studentData });
              } else if (qSnap && !qSnap.empty) {
                studentId = qSnap.docs[0].id;
                studentData = qSnap.docs[0].data();
                studentRosterCache.current.set(cleanUpper, { id: qSnap.docs[0].id, ...studentData });
              } else if (uuidSnap && !uuidSnap.empty) {
                studentId = uuidSnap.docs[0].id;
                studentData = uuidSnap.docs[0].data();
                studentRosterCache.current.set(cleanUpper, {
                  id: uuidSnap.docs[0].id,
                  ...studentData,
                });
              } else {
                const autoDoc = {
                  full_name: resolvedName,
                  index_number: cleanUpper,
                  owner_id: sess.owner_id || currentUid || "universal",
                  created_at: new Date().toISOString(),
                };
                void setDoc(doc(firestoreDb, "students", studentId), autoDoc, {
                  merge: true,
                }).catch(() => {});
              }
            } catch (err) {
              console.warn("Background student lookup warning:", err);
            }
          }

          const safeOwnerId = sess.owner_id || currentUid || firebaseAuth.currentUser?.uid || "faculty";
          const safeScannedBy = currentUid || firebaseAuth.currentUser?.uid || "faculty";

          const recordPayload = {
            session_id: sess.id,
            course_id: sess.course_id || null,
            student_id: studentId || `stud_${sanitizedUpper}`,
            student_name: studentData?.full_name || resolvedName || "Student",
            index_number: studentData?.index_number || resolvedIndex || cleanUpper,
            session_date: today,
            check_in_at: new Date().toISOString(),
            status: "PRESENT",
            scanned_by: safeScannedBy,
            owner_id: safeOwnerId,
            created_at: new Date().toISOString(),
          };

          await addDoc(collection(firestoreDb, "attendance_records"), recordPayload);
          qc.invalidateQueries({ queryKey: ["open-sessions"] });
        } catch (saveErr) {
          console.error("Async attendance save error:", saveErr);
          scannedRecordsSet.current.delete(cleanUpper);
          toast.error("Failed to sync attendance record to cloud.");
        }
      })();

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
  }, [activeSession, currentUid, handleCreateQuickSession, openSessions, qc]);

  // Clean, fail-safe camera shutdown
  const stopCamera = useCallback(() => {
    if (scanLoopTimerRef.current) {
      clearInterval(scanLoopTimerRef.current);
      scanLoopTimerRef.current = null;
    }
    isDecodingRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScanning(false);
    setIsStartingCam(false);
    setStatus("Camera stopped. Ready to scan.");
  }, []);

  // Clean, resilient camera start using native getUserMedia (zero FSM transition crashes)
  const startCamera = async (preferredFacing?: "environment" | "user", overrideCamId?: string) => {
    if (isStartingCam) return;
    setIsStartingCam(true);
    setCamError(null);
    setStatus("Opening camera stream…");

    // Ensure session exists
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

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Camera access is not supported on this browser or requires HTTPS.";
      setCamError(msg);
      toast.error(msg);
      setIsStartingCam(false);
      return;
    }

    stopCamera();

    const targetFacing = preferredFacing ?? facingMode;
    setFacingMode(targetFacing);

    // Enumerate camera devices for device selector
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      if (videoDevices.length > 0) {
        setAvailableCameras(videoDevices);
      }
    } catch {
      // Device enumeration failure non-blocking
    }

    // Try camera constraints with graceful fallbacks
    const chosenId = overrideCamId || selectedCameraId;
    const constraintCandidates: MediaStreamConstraints[] = [];

    if (chosenId) {
      constraintCandidates.push({
        video: { deviceId: { exact: chosenId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      constraintCandidates.push({ video: { deviceId: { exact: chosenId } } });
    }

    constraintCandidates.push({
      video: { facingMode: { ideal: targetFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    constraintCandidates.push({
      video: { facingMode: targetFacing },
    });
    constraintCandidates.push({
      video: { facingMode: targetFacing === "environment" ? "user" : "environment" },
    });
    constraintCandidates.push({
      video: true,
    });

    let activeStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintCandidates) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (activeStream && activeStream.getVideoTracks().length > 0) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        // Continue to next fallback constraint
      }
    }

    if (!activeStream) {
      console.error("Failed to acquire camera stream:", lastError);
      const msg =
        lastError?.name === "NotAllowedError" || lastError?.name === "PermissionDeniedError"
          ? "Camera permission denied. Please allow camera permissions in your browser address bar."
          : lastError?.name === "NotFoundError" || lastError?.name === "DevicesNotFoundError"
            ? "No camera device detected on this device."
            : lastError?.name === "NotReadableError" || lastError?.name === "TrackStartError"
              ? "Camera is in use by another tab or app. Please close other camera apps and retry."
              : lastError?.message || "Failed to start camera";
      setCamError(msg);
      toast.error(msg);
      setIsStartingCam(false);
      setStatus("Camera error");
      return;
    }

    streamRef.current = activeStream;

    // Attach to video element
    const video = videoRef.current;
    if (video) {
      video.srcObject = activeStream;
      try {
        await video.play();
      } catch (playErr) {
        console.warn("Video play warning:", playErr);
      }
    }

    setScanning(true);
    setIsStartingCam(false);
    setStatus("Camera active. Point student QR code at camera.");

    // Start high-performance frame scanning loop (~100ms / 10 FPS cadence)
    if (scanLoopTimerRef.current) {
      clearInterval(scanLoopTimerRef.current);
    }

    scanLoopTimerRef.current = setInterval(async () => {
      if (isDecodingRef.current) return;
      const v = videoRef.current;
      if (!v || v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) return;

      isDecodingRef.current = true;
      try {
        const decoded = await decodeImageToQr(v, barcodeDetectorRef.current);
        if (decoded) {
          void processQr(decoded);
        }
      } catch (decodeErr) {
        console.debug("Frame decode error:", decodeErr);
      } finally {
        isDecodingRef.current = false;
      }
    }, 90);
  };

  const flipCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    setSelectedCameraId("");
    if (scanning) {
      await startCamera(next);
    }
  };

  const closeSession = async () => {
    if (!activeSession) return;
    if (!confirm("Close this attendance session?")) return;
    stopCamera();
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

  // Image Upload / Drag-and-drop QR scan handler
  const handleImageFile = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        toast.info("Scanning uploaded image for QR pass…");
        const decoded = await decodeImageToQr(img, barcodeDetectorRef.current);
        if (decoded) {
          void processQr(decoded);
        } else {
          toast.error("No valid QR code detected in this image. Please try a clearer screenshot.");
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-20 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <span>Attendance Scanner</span>
              {scanning && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                  LIVE
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Ultra-fast camera scanner with instant audio confirmation and live cloud sync.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {openSessions && openSessions.length === 0 && (
              <Button
                size="sm"
                onClick={handleCreateQuickSession}
                disabled={creatingQuick}
                className="h-9 text-xs font-bold gap-1.5 cursor-pointer bg-[#0A1F44] text-white hover:bg-[#0A1F44]/90 dark:bg-white dark:text-[#0A1F44]"
              >
                <Plus className="size-3.5" />
                <span>{creatingQuick ? "Creating..." : "Start Quick Session"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Two-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Scanner Viewport Card: Spans 7 columns on desktop */}
          <Card className="lg:col-span-7 xl:col-span-7 border-2 border-border shadow-md bg-card rounded-2xl overflow-hidden flex flex-col">
            <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span>Scanner Viewport</span>
              </CardTitle>

              {/* Upload Pass Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImageFile(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs font-semibold gap-1.5 cursor-pointer border-border"
                title="Upload screenshot or photo of student pass"
              >
                <Upload className="size-3.5 text-primary" />
                <span className="hidden sm:inline">Upload Image</span>
              </Button>
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
                        {s.title || "Session"} (
                        {new Date(s.starts_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        )
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {session && (
                <div className="p-3 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/5 dark:bg-[#D4AF37]/10 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-foreground text-sm">
                      {session.courses?.code || "Course"}{" "}
                      {session.courses?.title ? `· ${session.courses.title}` : ""}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {session.title || "Open attendance session"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeSession}
                    className="h-8 text-[11px] font-bold text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
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

              {/* Viewport: Clean HTML5 Video stream with targeting reticle */}
              <div className="relative w-full flex justify-center py-2">
                <div
                  className={`w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl mx-auto rounded-2xl overflow-hidden bg-black relative border-2 shadow-lg min-h-[320px] flex items-center justify-center transition-all duration-200 ${
                    scanPulse
                      ? "border-emerald-500 ring-4 ring-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.5)]"
                      : "border-[#D4AF37]/50"
                  }`}
                  style={{ minHeight: "320px" }}
                >
                  {/* Clean native video element */}
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className={`w-full h-full object-cover min-h-[320px] max-h-[480px] ${
                      scanning ? "block" : "hidden"
                    }`}
                  />

                  {/* Targeting reticle and laser indicator */}
                  {scanning && !isStartingCam && (
                    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                      {/* Corner targeting brackets */}
                      <div className="absolute inset-6 sm:inset-10 pointer-events-none">
                        <div className="absolute top-0 left-0 size-8 sm:size-10 border-t-[3px] border-l-[3px] border-[#D4AF37] rounded-tl-md shadow-[0_0_10px_#D4AF37]" />
                        <div className="absolute top-0 right-0 size-8 sm:size-10 border-t-[3px] border-r-[3px] border-[#D4AF37] rounded-tr-md shadow-[0_0_10px_#D4AF37]" />
                        <div className="absolute bottom-0 left-0 size-8 sm:size-10 border-b-[3px] border-l-[3px] border-[#D4AF37] rounded-bl-md shadow-[0_0_10px_#D4AF37]" />
                        <div className="absolute bottom-0 right-0 size-8 sm:size-10 border-b-[3px] border-r-[3px] border-[#D4AF37] rounded-br-md shadow-[0_0_10px_#D4AF37]" />
                        {/* Rapid laser scanline */}
                        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent shadow-[0_0_12px_#D4AF37] animate-pulse" />
                      </div>

                      {/* Success scan confirmation flash */}
                      {scanPulse && (
                        <div className="absolute inset-0 bg-emerald-500/30 backdrop-blur-[1px] flex items-center justify-center transition-opacity">
                          <div className="size-20 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl animate-in zoom-in-75 duration-150">
                            <CheckCircle2 className="size-12 stroke-[2.5]" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Idle Overlay */}
                  {!scanning && !isStartingCam && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/80 select-none bg-black/85 z-10">
                      <div className="size-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-[#D4AF37] mb-3 shadow-inner">
                        <Camera className="size-8" />
                      </div>
                      <p className="text-base font-bold text-white">Camera Viewfinder Ready</p>
                      <p className="text-xs text-white/70 max-w-xs mt-1">
                        Click "Start Camera Scanner" below. Point student QR code at camera for instant detection.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 h-8 text-xs font-semibold gap-1.5 cursor-pointer bg-white/15 hover:bg-white/25 text-white border border-white/20"
                      >
                        <ImageIcon className="size-3.5 text-[#D4AF37]" />
                        Or scan from image file
                      </Button>
                    </div>
                  )}

                  {/* Starting Camera Loading Overlay */}
                  {isStartingCam && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white select-none bg-black/90 z-10">
                      <RefreshCw className="size-8 text-[#D4AF37] animate-spin mb-3" />
                      <p className="text-xs font-bold tracking-wide uppercase">Initializing camera hardware...</p>
                      <p className="text-[11px] text-white/70 mt-1">
                        Optimizing video stream for instant sub-second decoding
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="text-center text-xs">
                <span
                  className={
                    scanning
                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                      : "text-muted-foreground font-medium"
                  }
                >
                  {status}
                </span>
              </div>

              {/* Last Scan Feedback */}
              {lastScan && (
                <div className="p-3.5 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 text-xs flex items-center justify-between shadow-xs animate-in fade-in-50 duration-200">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <p className="font-bold text-foreground text-sm leading-tight">{lastScan.name}</p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                        {lastScan.status}
                      </p>
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
                    onClick={stopCamera}
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
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="h-10 text-xs font-bold cursor-pointer border-2 border-[#D4AF37]/50"
                >
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
                <span>Verified Scans in Session</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#0A1F44]/10 dark:bg-white/10 text-foreground">
                  {recentRecords.length} Students
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <div className="divide-y divide-border/60 max-h-[640px] overflow-y-auto">
                {recentRecords.map((r: any) => (
                  <div
                    key={r.id}
                    className="p-3.5 px-4 flex items-center justify-between text-xs hover:bg-muted/40 transition-colors animate-in fade-in-50 duration-150"
                  >
                    <div>
                      <p className="font-extrabold text-foreground text-sm">
                        {r.students?.full_name || r.student_name || "Student"}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {r.students?.index_number || r.index_number}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-xs gap-1">
                        <CheckCircle2 className="size-3.5" />
                        <span>PRESENT</span>
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(r.check_in_at || r.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {recentRecords.length === 0 && (
                  <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
                    <p className="font-bold text-foreground">No scans recorded yet</p>
                    <p>
                      Start the camera and point a student QR pass, enter an index number above, or upload a pass image.
                    </p>
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
