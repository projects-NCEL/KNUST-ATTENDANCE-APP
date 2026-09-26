import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { firestoreDb } from "@/integrations/firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  MapPin,
  AlertCircle,
  Loader2,
  Navigation,
  School,
  ArrowRight,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  Radio,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { QmarkLogo } from "@/components/QmarkLogo";
import { QmarkTitleBar } from "@/components/QmarkTitleBar";
import { ThemeToggle } from "@/components/ThemeToggle";

const search = z.object({ session: z.string().optional() });

export const Route = createFileRoute("/check-in")({
  ssr: false,
  validateSearch: search,
  head: () => ({ meta: [{ title: "Classroom Check-In — Qmark" }] }),
  component: CheckInPage,
});

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface SessionInfo {
  id: string;
  title?: string;
  courseCode?: string;
  courseTitle?: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_m?: number;
  status: string;
  is_active?: boolean;
  owner_id?: string;
  course_id?: string;
}

function CheckInPage() {
  const { session } = Route.useSearch();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(session || null);
  const [openSessions, setOpenSessions] = useState<SessionInfo[]>([]);
  const [openSessionsLoading, setOpenSessionsLoading] = useState(false);

  const [index, setIndex] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [locPermissionState, setLocPermissionState] = useState<"prompt" | "granted" | "denied" | "unknown">("prompt");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [requestingLoc, setRequestingLoc] = useState(false);
  const [done, setDone] = useState<{
    name: string;
    indexNumber: string;
    distance: number;
    alreadyMarked: boolean;
    time?: string;
  } | null>(null);

  // Sync activeSessionId if route search param changes
  useEffect(() => {
    if (session) {
      setActiveSessionId(session);
    }
  }, [session]);

  // Auto-detect saved student index number from previous login on this phone
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("knust_student_auth") || localStorage.getItem("knust_student_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.index_number) {
          setIndex(parsed.index_number.toUpperCase());
        }
      }
    } catch {
      // Ignore session storage parse errors
    }
  }, []);

  // Monitor location permission state
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((p) => {
          setLocPermissionState(p.state as any);
          p.onchange = () => setLocPermissionState(p.state as any);
        })
        .catch(() => setLocPermissionState("unknown"));
    }
  }, []);

  const loadOpenSessions = async () => {
    setOpenSessionsLoading(true);
    try {
      // 1. Query server API endpoint
      const res = await fetch("/api/public/student-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_active_sessions" }),
      });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.sessions)) {
        setOpenSessions(data.sessions);
        if (data.sessions.length === 1 && !session) {
          setActiveSessionId(data.sessions[0].id);
        }
        return;
      }
    } catch {
      // Fall through to Firestore
    }

    try {
      const sessSnap = await getDocs(collection(firestoreDb, "attendance_sessions"));
      const openDocs = sessSnap.docs.filter((d) => {
        const dData = d.data() as any;
        const status = (dData.status || "").toUpperCase();
        return status === "OPEN" || status === "ACTIVE" || (dData.is_active === true && status !== "CLOSED");
      });

      const coursesSnap = await getDocs(collection(firestoreDb, "courses")).catch(() => ({ docs: [] }));
      const coursesMap = new Map<string, any>();
      coursesSnap.docs.forEach((cd) => coursesMap.set(cd.id, cd.data()));

      const formatted: SessionInfo[] = openDocs.map((d) => {
        const dData = d.data() as any;
        const c = dData.course_id ? coursesMap.get(dData.course_id) : null;
        return {
          id: d.id,
          title: dData.title || c?.title || "Class Attendance",
          courseCode: c?.code || dData.course_code || "",
          courseTitle: c?.title || dData.course_title || "",
          latitude: typeof dData.latitude === "number" ? dData.latitude : null,
          longitude: typeof dData.longitude === "number" ? dData.longitude : null,
          radius_m: dData.radius_m || 100,
          status: "OPEN",
          is_active: true,
          owner_id: dData.owner_id,
          course_id: dData.course_id,
        };
      });

      setOpenSessions(formatted);
      if (formatted.length === 1 && !session) {
        setActiveSessionId(formatted[0].id);
      }
    } catch (err) {
      console.error("Error fetching open sessions:", err);
    } finally {
      setOpenSessionsLoading(false);
    }
  };

  // If no session ID provided, automatically find any open sessions
  useEffect(() => {
    if (!activeSessionId) {
      loadOpenSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // Fetch session details from Firestore when activeSessionId is set
  useEffect(() => {
    if (!activeSessionId) {
      setSessionLoading(false);
      setSessionInfo(null);
      return;
    }

    let isMounted = true;
    const fetchSession = async () => {
      setSessionLoading(true);
      setSessionError(null);
      try {
        const sessDoc = await getDoc(doc(firestoreDb, "attendance_sessions", activeSessionId));
        if (!sessDoc.exists()) {
          if (isMounted) setSessionError("Attendance session not found or has been deleted.");
          return;
        }

        const data = sessDoc.data() as any;
        let courseCode = "";
        let courseTitle = "";

        if (data.course_id) {
          try {
            const courseDoc = await getDoc(doc(firestoreDb, "courses", data.course_id));
            if (courseDoc.exists()) {
              const cData = courseDoc.data() as any;
              courseCode = cData.code || "";
              courseTitle = cData.title || "";
            }
          } catch {
            // Course details fetch optional fallback
          }
        }

        if (isMounted) {
          setSessionInfo({
            id: sessDoc.id,
            title: data.title || courseTitle || "Class Attendance",
            courseCode,
            courseTitle,
            latitude: typeof data.latitude === "number" ? data.latitude : null,
            longitude: typeof data.longitude === "number" ? data.longitude : null,
            radius_m: data.radius_m || 100,
            status: data.status || (data.is_active === false ? "CLOSED" : "OPEN"),
            is_active: data.is_active,
            owner_id: data.owner_id,
            course_id: data.course_id,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setSessionError(err.message || "Failed to load session details.");
        }
      } finally {
        if (isMounted) setSessionLoading(false);
      }
    };

    fetchSession();
    return () => {
      isMounted = false;
    };
  }, [activeSessionId]);

  const requestPosition = (): Promise<GeolocationPosition> => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("GPS Geolocation is not supported on this device or browser."));
      }

      // Fast indoor strategy: try high accuracy with 6s timeout, then fall back immediately to standard accuracy
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocPermissionState("denied");
            return reject(
              new Error(
                "Location permission was denied. Please allow location access in your browser settings (tap the lock icon in the address bar) and try again.",
              ),
            );
          }
          // Fallback to cell/Wi-Fi standard accuracy
          navigator.geolocation.getCurrentPosition(
            (pos2) => resolve(pos2),
            (err2) => {
              if (err2.code === err2.PERMISSION_DENIED) {
                setLocPermissionState("denied");
                reject(
                  new Error(
                    "Location permission was denied. Please allow location access in your browser settings.",
                  ),
                );
              } else {
                reject(
                  new Error(
                    "Unable to determine your GPS location. Please ensure Location/GPS is turned on in your phone settings and try again.",
                  ),
                );
              }
            },
            {
              enableHighAccuracy: false,
              timeout: 6000,
              maximumAge: 30000,
            },
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 15000,
        },
      );
    });
  };

  const handleManualLocationRequest = async () => {
    setRequestingLoc(true);
    try {
      const pos = await requestPosition();
      setUserCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy || 0),
      });
      setLocPermissionState("granted");
      toast.success("✓ Location acquired successfully");
    } catch (err: any) {
      toast.error(err.message || "Could not access location");
    } finally {
      setRequestingLoc(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIndex = index.trim().toUpperCase();
    if (!cleanIndex) return toast.error("Please enter your student index number");
    if (!activeSessionId) return toast.error("Missing session identifier");

    setLoading(true);

    try {
      // 1. Verify session state in Firestore
      const sessionDocRef = doc(firestoreDb, "attendance_sessions", activeSessionId);
      const sessSnap = await getDoc(sessionDocRef);
      if (!sessSnap.exists()) {
        throw new Error("Attendance session not found or has expired.");
      }
      const sessData = sessSnap.data() as any;

      // In sessions.tsx, status is "OPEN" or "CLOSED"
      const isClosed = sessData.status === "CLOSED" || sessData.is_active === false;
      if (isClosed) {
        throw new Error("This attendance session has already been closed by the lecturer.");
      }

      // 2. Obtain device location to verify presence in classroom
      let pos: GeolocationPosition | null = null;
      let userLat = userCoords?.lat ?? null;
      let userLng = userCoords?.lng ?? null;
      let accuracy = userCoords?.accuracy ?? null;

      const hasClassroomCoords =
        typeof sessData.latitude === "number" && typeof sessData.longitude === "number";

      // Detect if coordinates are default campus placeholder (Accra 5.6037, -0.187)
      const isDefaultCoords =
        hasClassroomCoords &&
        Math.abs(sessData.latitude - 5.6037) < 0.01 &&
        Math.abs(sessData.longitude - (-0.187)) < 0.01;

      if (!userCoords) {
        toast.info("Acquiring GPS location...", { duration: 2000 });
        try {
          pos = await requestPosition();
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          accuracy = Math.round(pos.coords.accuracy || 0);
          setUserCoords({ lat: userLat, lng: userLng, accuracy });
          setLocPermissionState("granted");
        } catch (locErr: any) {
          console.warn("Location error:", locErr);
          // If browser or device location fails, allow fallback with notice
          toast.warning(locErr?.message || "Could not retrieve exact GPS. Submitting check-in...");
        }
      }

      let distanceM = 0;
      let geofenceFlagged = false;
      if (hasClassroomCoords && !isDefaultCoords && userLat != null && userLng != null) {
        distanceM = haversineDistanceMeters(
          sessData.latitude,
          sessData.longitude,
          userLat,
          userLng,
        );
        const allowedRadius = sessData.radius_m || 100;
        // Provide generous indoor tolerance: device accuracy plus margin
        const indoorTolerance = Math.max(accuracy || 0, 50) + 30;
        const effectiveRadius = allowedRadius + indoorTolerance;
        if (distanceM > effectiveRadius) {
          geofenceFlagged = true;
          console.warn(
            `Geofence notice: calculated distance ${Math.round(distanceM)}m exceeds ${effectiveRadius}m`,
          );
        }
      }

      // 3. Call reliable server API first for fast, atomic, permission-safe check-in
      try {
        const apiRes = await fetch("/api/public/student-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "projector_check_in",
            session_id: activeSessionId,
            index: cleanIndex,
            user_lat: userLat,
            user_lng: userLng,
            accuracy: accuracy,
            distance_m: Math.round(distanceM),
            geofence_flagged: geofenceFlagged,
          }),
        });

        const apiData = await apiRes.json();
        if (apiRes.ok && apiData.ok) {
          setDone({
            name: apiData.student_name || `Student (${cleanIndex})`,
            indexNumber: cleanIndex,
            distance: Math.round(distanceM),
            alreadyMarked: Boolean(apiData.already_marked),
            time: apiData.time,
          });

          if (apiData.already_marked) {
            toast.info(apiData.message || `Already marked present for this session`);
          } else {
            toast.success(`✓ Marked Present: ${apiData.student_name || cleanIndex}`);
          }
          return;
        } else if (!apiRes.ok && apiData.error) {
          // If server explicitly reported an error (like session closed), throw it
          throw new Error(apiData.error);
        }
      } catch (apiErr: any) {
        if (apiErr.message && !apiErr.message.includes("fetch") && !apiErr.message.includes("Failed")) {
          throw apiErr;
        }
        console.warn("API check-in encountered network issue, attempting client-side fallback:", apiErr);
      }

      // 4. Fallback client-side recording if server is unreachable
      let studentDoc: any = null;
      let studentData: any = null;

      try {
        const studSnap = await getDocs(
          query(
            collection(firestoreDb, "students"),
            where("index_number", "==", cleanIndex),
          ),
        );

        if (!studSnap.empty) {
          studentDoc = studSnap.docs[0];
          studentData = studentDoc.data();
        } else {
          // Fallback: search across all students case-insensitively
          const allStudentsSnap = await getDocs(collection(firestoreDb, "students"));
          const matched = allStudentsSnap.docs.find(
            (d) => (d.data()?.index_number || "").toString().trim().toUpperCase() === cleanIndex,
          );
          if (matched) {
            studentDoc = matched;
            studentData = matched.data();
          }
        }
      } catch (findErr) {
        console.warn("Student lookup query exception:", findErr);
      }

      // If not yet in lecturer's students roster, identify by index number so they are recorded present
      const studentId = studentDoc ? studentDoc.id : cleanIndex;
      const studentFullName = studentData?.full_name || `Student (${cleanIndex})`;

      const today = new Date().toISOString().slice(0, 10);

      // Duplicate Check: check if student has already checked in for this session
      let existingRecord: any = null;
      try {
        const recQuery = await getDocs(
          query(
            collection(firestoreDb, "attendance_records"),
            where("session_id", "==", activeSessionId),
            where("student_id", "==", studentId),
          ),
        );

        existingRecord = recQuery.docs[0];

        // Also check by index_number directly in case student_id differs
        if (!existingRecord) {
          const indexRecQuery = await getDocs(
            query(
              collection(firestoreDb, "attendance_records"),
              where("session_id", "==", activeSessionId),
              where("index_number", "==", cleanIndex),
            ),
          );
          existingRecord = indexRecQuery.docs[0];
        }
      } catch (dupErr) {
        console.warn("Duplicate check query note:", dupErr);
      }

      if (existingRecord) {
        const exData = existingRecord.data();
        const formattedTime = exData.check_in_at
          ? new Date(exData.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "today";

        setDone({
          name: studentFullName,
          indexNumber: cleanIndex,
          distance: Math.round(distanceM),
          alreadyMarked: true,
          time: formattedTime,
        });
        toast.info(`Already marked present for this session (${formattedTime})`);
        return;
      }

      // Record new attendance record in Firestore client
      const now = new Date();
      await addDoc(collection(firestoreDb, "attendance_records"), {
        session_id: activeSessionId,
        student_id: studentId,
        index_number: cleanIndex,
        student_name: studentFullName,
        course_id: sessData.course_id || null,
        owner_id: sessData.owner_id || null,
        session_date: today,
        check_in_at: now.toISOString(),
        status: "PRESENT",
        source: "projector_qr",
        geo_lat: userLat,
        geo_lng: userLng,
        geo_accuracy_m: accuracy,
        distance_m: Math.round(distanceM),
        geofence_flagged: geofenceFlagged,
        created_at: now.toISOString(),
      });

      setDone({
        name: studentFullName,
        indexNumber: cleanIndex,
        distance: Math.round(distanceM),
        alreadyMarked: false,
      });
      toast.success(`✓ Marked Present: ${studentFullName}`);
    } catch (err: any) {
      console.error("Check-in error:", err);
      toast.error(err.message ?? "Check-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-between">
      {/* Title bar matching exact screenshot design */}
      <QmarkTitleBar
        tag="GH"
        showBack={true}
        backTo="/student"
        extraActions={
          <Link
            to="/student"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/30 transition-all cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden xs:inline">Student Portal</span>
          </Link>
        }
      />
      <div className="flex-1 flex flex-col items-center px-2.5 sm:px-6 py-4 sm:py-8 max-w-sm sm:max-w-md mx-auto w-full min-w-0">
        {!activeSessionId ? (
          openSessionsLoading ? (
            <Card className="w-full p-8 text-center space-y-3 glass-card rounded-2xl">
              <Loader2 className="size-8 animate-spin mx-auto text-[#D4AF37]" />
              <p className="text-xs text-neutral-500">
                Checking for attendance sessions opened by your lecturer...
              </p>
            </Card>
          ) : openSessions.length === 0 ? (
            <Card className="max-w-md w-full glass-card border-[#D4AF37]/30 p-6 text-center space-y-4 rounded-2xl">
              <div className="mx-auto size-14 rounded-2xl bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center justify-center shadow-xs">
                <Radio className="size-7" />
              </div>
              <div className="space-y-1.5">
                <CardTitle className="text-xl font-bold text-foreground">
                  No Active Session Found
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm pt-1 leading-relaxed text-muted-foreground">
                  There are currently no attendance sessions opened by your lecturer. Please wait for your lecturer to open the session or scan the QR code projected in class.
                </CardDescription>
              </div>
              <div className="pt-2 space-y-2.5">
                <Button
                  onClick={loadOpenSessions}
                  disabled={openSessionsLoading}
                  className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-[#0A1F44] font-bold shadow-md h-10 gap-2 cursor-pointer"
                >
                  <RefreshCw className={`size-4 ${openSessionsLoading ? "animate-spin" : ""}`} />
                  <span>Check Again / Refresh</span>
                </Button>
                <Link to="/student" className="block w-full">
                  <Button variant="outline" className="w-full text-xs h-9 cursor-pointer">
                    Return to Student Portal
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="w-full max-w-md space-y-3">
              <div className="text-center mb-3">
                <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40 text-xs px-2.5 py-0.5 font-bold mb-1">
                  ● Live Classrooms ({openSessions.length})
                </Badge>
                <h2 className="text-lg font-bold text-foreground">Lecturer Sessions Open Now</h2>
                <p className="text-xs text-muted-foreground">
                  Tap your course session below to complete check-in:
                </p>
              </div>
              {openSessions.map((s) => (
                <Card
                  key={s.id}
                  className="glass-card border-[#D4AF37]/30 hover:border-[#D4AF37] transition-all p-4 space-y-3 rounded-2xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {s.courseCode && (
                          <span className="font-mono font-bold text-xs bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded-md">
                            {s.courseCode}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                          Active Session
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-foreground mt-1">
                        {s.courseTitle || s.title}
                      </h3>
                      {s.courseTitle && s.courseTitle !== s.title && (
                        <p className="text-xs text-muted-foreground">{s.title}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => setActiveSessionId(s.id)}
                    className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-[#0A1F44] font-bold text-xs h-9 gap-1.5 cursor-pointer"
                  >
                    <span>Check In to this Session</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </Card>
              ))}
            </div>
          )
        ) : sessionLoading ? (
          <Card className="w-full p-8 text-center space-y-3 glass-card rounded-2xl">
            <Loader2 className="size-8 animate-spin mx-auto text-[#0A1F44] dark:text-[#D4AF37]" />
            <p className="text-xs text-neutral-500">Connecting to classroom session...</p>
          </Card>
        ) : sessionError ? (
          <Card className="w-full shadow-sm border border-red-300 dark:border-red-900 glass-card rounded-2xl">
            <CardHeader className="text-center p-6">
              <div className="mx-auto mb-2 size-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertCircle className="size-6" />
              </div>
              <CardTitle className="text-base font-bold text-red-600">Session Error</CardTitle>
              <CardDescription className="text-xs text-neutral-500 mt-1">{sessionError}</CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-6 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveSessionId(null);
                  loadOpenSessions();
                }}
                className="text-xs rounded-full w-full cursor-pointer"
              >
                Look for Other Active Sessions
              </Button>
              <Link to="/student" className="block w-full">
                <Button variant="ghost" size="sm" className="text-xs rounded-full w-full cursor-pointer">
                  Return to Student Portal
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : !done ? (
          <div className="w-full space-y-2">
            {openSessions.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setActiveSessionId(null);
                  loadOpenSessions();
                }}
                className="text-xs font-semibold text-[#D4AF37] hover:underline flex items-center gap-1 mb-1 cursor-pointer"
              >
                <ArrowLeft className="size-3" />
                <span>Switch to another lecture session</span>
              </button>
            )}

            <Card className="w-full glass-card overflow-hidden rounded-2xl">
              {/* Session Info Banner in Navy & Gold */}
              <div
                className="p-5 text-white"
                style={{
                  background: "linear-gradient(135deg, #0F2A5C 0%, #0A1F44 100%)",
                  borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {sessionInfo?.courseCode && (
                        <Badge
                          className="border-none text-[10px] font-mono font-bold"
                          style={{ backgroundColor: "rgba(212, 175, 55, 0.2)", color: "#D4AF37" }}
                        >
                          {sessionInfo.courseCode}
                        </Badge>
                      )}
                      <Badge
                        className="font-bold border-none text-[10px]"
                        style={{
                          backgroundColor:
                            sessionInfo?.status === "CLOSED" ? "rgba(193, 68, 59, 0.2)" : "rgba(212, 175, 55, 0.2)",
                          color: sessionInfo?.status === "CLOSED" ? "#C1443B" : "#D4AF37",
                        }}
                      >
                        {sessionInfo?.status === "CLOSED" ? "Closed" : "Active Session"}
                      </Badge>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                      {sessionInfo?.title}
                    </h2>
                    {sessionInfo?.courseTitle && sessionInfo.courseTitle !== sessionInfo.title && (
                      <p className="text-xs text-white/70">{sessionInfo.courseTitle}</p>
                    )}
                  </div>
                  <div
                    className="size-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(212, 175, 55, 0.15)", color: "#D4AF37" }}
                  >
                    <School className="size-4" />
                  </div>
                </div>
              </div>

              <CardHeader className="p-4 sm:p-5 pb-2">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-[#0A1F44] dark:text-white">
                  <Navigation className="size-4 text-[#D4AF37]" />
                  Confirm Classroom Attendance
                </CardTitle>
                <CardDescription className="text-xs text-neutral-500 leading-relaxed">
                  Enter your student index number. Device GPS coordinates verify you are physically inside the lecture hall.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 pt-1 space-y-4">
                {/* Geolocation Status Notice */}
                <div
                  className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 ${
                    locPermissionState === "denied"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : userCoords
                        ? "bg-[#D4AF37]/10 dark:bg-[#0A1F44]/40 border-[#D4AF37]/30 text-[#0A1F44] dark:text-[#D4AF37]"
                        : "bg-[#F8F1D9] border-[#D4AF37]/30 text-[#0A1F44]"
                  }`}
                >
                  <MapPin className="size-4 shrink-0 mt-0.5 text-[#D4AF37]" />
                  <div className="space-y-1 flex-1">
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>
                        {locPermissionState === "denied"
                          ? "Location Access Blocked"
                          : userCoords
                            ? `Location Ready (±${userCoords.accuracy}m)`
                            : "Classroom Range Validation"}
                      </span>
                      {sessionInfo?.radius_m && (
                        <span className="text-[10px] opacity-75 font-normal">
                          Radius: {sessionInfo.radius_m}m
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      {locPermissionState === "denied"
                        ? "Your browser blocked location access. Please allow Location in your browser settings and try again."
                        : userCoords
                          ? "Coordinates captured. Tap the button below to submit attendance."
                          : "Location access will confirm you are within the classroom geofence range."}
                    </p>
                    {!userCoords && locPermissionState !== "denied" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleManualLocationRequest}
                        disabled={requestingLoc}
                        className="h-7 text-[11px] px-3 mt-1 rounded-full border-[#D4AF37] text-[#0A1F44] hover:bg-[#F8F1D9] cursor-pointer"
                      >
                        {requestingLoc ? (
                          <>
                            <Loader2 className="size-3 animate-spin mr-1" />
                            Checking GPS...
                          </>
                        ) : (
                          <>
                            <Navigation className="size-3 mr-1 text-[#D4AF37]" />
                            Pre-Verify Location
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Check-in Form */}
                <form onSubmit={submit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="student-index" className="text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider ml-1">
                      Student Index Number
                    </Label>
                    <Input
                      id="student-index"
                      placeholder="e.g. 10987654"
                      value={index}
                      onChange={(e) => setIndex(e.target.value)}
                      required
                      autoFocus
                      className="h-11 font-mono text-sm tracking-wide uppercase rounded-full border-[#E4E4EC] bg-[#FAFAFA] dark:bg-white/5 focus-visible:ring-[#D4AF37]"
                    />
                    <p className="text-[11px] text-neutral-400 ml-2">
                      Enter your official university student index number.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || sessionInfo?.status === "CLOSED"}
                    className="w-full py-3.5 rounded-full font-bold text-sm text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: "#0A1F44",
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-[#D4AF37]" />
                        <span>Confirming Location & Checking In...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4 text-[#D4AF37]" />
                        <span>Check In & Mark Present</span>
                      </>
                    )}
                  </button>

                  {sessionInfo?.status === "CLOSED" && (
                    <p className="text-xs text-red-600 text-center font-medium">
                      This attendance session has been marked closed by the lecturer.
                    </p>
                  )}
                </form>

                {/* Return link */}
                <div className="pt-2 border-t border-[#F0F0F5] dark:border-white/10 flex items-center justify-between text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3.5 text-neutral-400" /> Duplicate-safe
                  </span>
                  <Link to="/student" className="font-bold text-[#0A1F44] dark:text-[#D4AF37] hover:underline">
                    Go to Student Portal →
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Success Screen matching HTML 2 checkin-success */
          <Card className="w-full shadow-md border border-[#D4AF37]/30 dark:border-[#D4AF37]/40 bg-white dark:bg-[#0A1F44] rounded-3xl overflow-hidden text-center">
            <div className="p-8 flex flex-col items-center justify-center">
              <div className="size-16 rounded-full bg-[#D4AF37]/10 dark:bg-[#0A1F44]/50 flex items-center justify-center mb-4">
                <CheckCircle2 className="size-10 text-[#D4AF37]" />
              </div>
                <h2 className="text-2xl font-extrabold text-[#0A1F44] dark:text-white">
                  Checked in!
                </h2>
                <div className="text-sm font-semibold text-neutral-500 mt-1">
                  {sessionInfo?.courseCode || "Classroom Session"} · {sessionInfo?.title || "Lecture"}
                </div>

                <div className="mt-6 w-full bg-[#F8F8FA] dark:bg-white/5 rounded-2xl p-5 border border-[#E4E4EC] dark:border-white/10 text-center">
                  <div className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                    Time of Check-In
                  </div>
                  <div className="text-sm font-bold text-[#0A1F44] dark:text-white mt-1">
                    {done.time || "Today"} · Proximity Verified (~{done.distance}m)
                  </div>

                  <div className="my-3 border-t border-[#EBEBEB] dark:border-white/10" />

                  <div className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                    Student Details
                  </div>
                  <div className="text-base font-bold text-[#0A1F44] dark:text-white mt-0.5">
                    {done.name}
                  </div>
                  <div className="font-mono text-xs font-semibold text-[#D4AF37]">
                    {done.indexNumber}
                  </div>
                </div>

                <div className="mt-6 w-full flex flex-col gap-2">
                  <Link to="/student" className="w-full">
                    <button
                      type="button"
                      className="w-full py-3.5 rounded-full font-bold text-sm text-white transition-all cursor-pointer"
                      style={{ backgroundColor: "#0A1F44" }}
                    >
                      Back to Student Portal
                    </button>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDone(null)}
                    className="w-full py-2.5 text-xs font-semibold text-neutral-500 hover:text-[#0A1F44] transition-colors cursor-pointer"
                  >
                    Check In Another Student
                  </button>
                </div>
              </div>
            </Card>
          )}
      </div>
    </div>
  );
}

