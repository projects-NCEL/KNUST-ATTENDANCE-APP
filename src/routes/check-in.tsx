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
} from "lucide-react";
import { toast } from "sonner";
import { PublicFooter } from "@/components/PublicFooter";
import { KnustEmblem } from "@/components/KnustEmblem";

const search = z.object({ session: z.string().optional() });

export const Route = createFileRoute("/check-in")({
  ssr: false,
  validateSearch: search,
  head: () => ({ meta: [{ title: "Classroom Check In — KNUST QRoll" }] }),
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
  const [index, setIndex] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
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

  // Fetch session details from Firestore
  useEffect(() => {
    if (!session) {
      setSessionLoading(false);
      return;
    }

    let isMounted = true;
    const fetchSession = async () => {
      setSessionLoading(true);
      setSessionError(null);
      try {
        const sessDoc = await getDoc(doc(firestoreDb, "attendance_sessions", session));
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
  }, [session]);

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
    if (!session) return toast.error("Missing session identifier");

    setLoading(true);

    try {
      // 1. Verify session state in Firestore
      const sessionDocRef = doc(firestoreDb, "attendance_sessions", session);
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
            session_id: session,
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
            where("session_id", "==", session),
            where("student_id", "==", studentId),
          ),
        );

        existingRecord = recQuery.docs[0];

        // Also check by index_number directly in case student_id differs
        if (!existingRecord) {
          const indexRecQuery = await getDocs(
            query(
              collection(firestoreDb, "attendance_records"),
              where("session_id", "==", session),
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
        session_id: session,
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

  if (!session) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col justify-between">
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <Card className="max-w-md w-full shadow-lg border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertCircle className="size-6" />
              </div>
              <CardTitle className="text-xl">Invalid Check-In Link</CardTitle>
              <CardDescription className="text-xs sm:text-sm pt-1">
                This check-in link is missing a session code. Please scan the dynamic QR code projected onto the lecture hall screen.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 text-center">
              <Link to="/student">
                <Button className="w-full bg-primary text-primary-foreground font-semibold">
                  Open Student Portal
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col justify-between">
      <div className="flex-1 flex flex-col items-center px-2.5 sm:px-6 py-3 sm:py-6 max-w-sm sm:max-w-md mx-auto w-full min-w-0">
        {/* Header Branding */}
        <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6 mt-2">
          <KnustEmblem size={34} />
          <div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-foreground">
              KNUST Student Check-In
            </h1>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">
              Classroom Projector Attendance Gateway
            </p>
          </div>
        </div>

        {sessionLoading ? (
          <Card className="w-full p-8 text-center space-y-3">
            <Loader2 className="size-8 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Connecting to lecture hall session...</p>
          </Card>
        ) : sessionError ? (
          <Card className="w-full shadow-md border-destructive/30">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertCircle className="size-5" />
              </div>
              <CardTitle className="text-base text-destructive">Session Error</CardTitle>
              <CardDescription className="text-xs">{sessionError}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link to="/student">
                <Button variant="outline" size="sm" className="text-xs">
                  Return to Student Portal
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : !done ? (
          <Card className="w-full shadow-md border border-primary/20 overflow-hidden">
            {/* Session Info Banner */}
            <div className="bg-gradient-to-r from-[#00381c] via-[#00552b] to-[#007a3d] p-4 text-white">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sessionInfo?.courseCode && (
                      <Badge className="bg-white/20 text-white border-none text-[10px] font-mono">
                        {sessionInfo.courseCode}
                      </Badge>
                    )}
                    <Badge className="bg-emerald-400/90 text-emerald-950 font-bold border-none text-[10px]">
                      {sessionInfo?.status === "CLOSED" ? "Closed" : "Active Session"}
                    </Badge>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                    {sessionInfo?.title}
                  </h2>
                  {sessionInfo?.courseTitle && sessionInfo.courseTitle !== sessionInfo.title && (
                    <p className="text-xs text-white/80">{sessionInfo.courseTitle}</p>
                  )}
                </div>
                <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <School className="size-4 text-white" />
                </div>
              </div>
            </div>

            <CardHeader className="p-4 sm:p-5 pb-2">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <Navigation className="size-4 text-primary" />
                Confirm Classroom Attendance
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Enter your university index number. To prevent proxy attendance, your device GPS coordinates verify you are physically inside the lecture hall.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 pt-1 space-y-4">
              {/* Geolocation Status Notice */}
              <div
                className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 ${
                  locPermissionState === "denied"
                    ? "bg-destructive/10 border-destructive/30 text-destructive"
                    : userCoords
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300"
                      : "bg-primary/5 border-primary/20 text-foreground"
                }`}
              >
                <MapPin className="size-4 shrink-0 mt-0.5" />
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
                      ? "Your browser blocked location access. Please tap the permissions lock in your address bar and toggle Location to 'Allow', then retry."
                      : userCoords
                        ? "Device coordinates captured. Tap the button below to submit your attendance."
                        : "Location access will be requested upon clicking check-in to confirm your presence."}
                  </p>
                  {!userCoords && locPermissionState !== "denied" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleManualLocationRequest}
                      disabled={requestingLoc}
                      className="h-7 text-[11px] px-2.5 mt-1 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                    >
                      {requestingLoc ? (
                        <>
                          <Loader2 className="size-3 animate-spin mr-1" />
                          Checking GPS...
                        </>
                      ) : (
                        <>
                          <Navigation className="size-3 mr-1" />
                          Pre-Verify My Location
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Check-in Form */}
              <form onSubmit={submit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="student-index" className="text-xs font-semibold">
                    Student Index Number
                  </Label>
                  <Input
                    id="student-index"
                    placeholder="e.g. 2084931"
                    value={index}
                    onChange={(e) => setIndex(e.target.value)}
                    required
                    autoFocus
                    className="h-10 font-mono text-sm tracking-wide uppercase"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must match your enrolled KNUST student record.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading || sessionInfo?.status === "CLOSED"}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs sm:text-sm gap-2 shadow-xs cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying Range & Checking In...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Check In & Mark Present
                    </>
                  )}
                </Button>

                {sessionInfo?.status === "CLOSED" && (
                  <p className="text-xs text-destructive text-center font-medium">
                    This attendance session has been marked closed by the lecturer.
                  </p>
                )}
              </form>

              {/* Anti-fraud Notice - Stacked Vertically for Portrait Mobile */}
              <div className="pt-2 border-t flex flex-col items-center gap-1.5 text-[11px] text-muted-foreground text-center">
                <span className="flex items-center gap-1 justify-center">
                  <ShieldCheck className="size-3.5 text-primary shrink-0" /> Duplicate-safe verification
                </span>
                <Link to="/student" className="text-primary hover:underline font-medium">
                  Go to Student Portal →
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Success Screen */
          <Card className="w-full shadow-lg border-emerald-500/30 overflow-hidden text-center animate-in fade-in">
            <div className="bg-emerald-600 p-6 text-white text-center space-y-2">
              <div className="mx-auto size-14 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner">
                <CheckCircle2 className="size-8 text-white" />
              </div>
              <h2 className="text-xl font-extrabold text-white">
                {done.alreadyMarked ? "Attendance Already Recorded" : "Marked Present!"}
              </h2>
              <p className="text-xs text-white/90">
                {done.alreadyMarked
                  ? `You are already registered as present for this session (${done.time || "today"}).`
                  : "Your classroom attendance has been permanently recorded."}
              </p>
            </div>

            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="rounded-xl bg-muted/50 p-4 border text-left space-y-2">
                <div className="flex justify-between items-center text-xs pb-2 border-b">
                  <span className="text-muted-foreground">Student Name</span>
                  <span className="font-bold text-foreground">{done.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-2 border-b">
                  <span className="text-muted-foreground">Index Number</span>
                  <span className="font-mono font-bold text-foreground">{done.indexNumber}</span>
                </div>
                {sessionInfo?.courseCode && (
                  <div className="flex justify-between items-center text-xs pb-2 border-b">
                    <span className="text-muted-foreground">Course</span>
                    <span className="font-bold text-primary">{sessionInfo.courseCode}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Geofence Proximity</span>
                  <span className="font-semibold text-emerald-600">
                    Verified ~{done.distance}m from classroom
                  </span>
                </div>
              </div>

              {/* Action buttons stacked for portrait mobile */}
              <div className="flex flex-col gap-2 pt-2 w-full max-w-xs mx-auto">
                <Link to="/student" className="w-full">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 gap-1.5 cursor-pointer">
                    Open Student Portal <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDone(null)}
                  className="w-full text-xs h-9"
                >
                  Check In Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}

