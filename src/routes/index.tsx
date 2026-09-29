import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  GraduationCap,
  Building2,
  QrCode,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  CalendarCheck,
  MapPin,
  FileSpreadsheet,
} from "lucide-react";
import { QmarkTitleBar } from "@/components/QmarkTitleBar";
import { AddToHomeScreenBanner } from "@/components/AddToHomeScreenBanner";
import { firebaseAuth, onAuthStateChanged } from "@/integrations/firebase/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Qmark — Attendance, verified instantly." },
      {
        name: "description",
        content:
          "Qmark: Next-generation attendance platform. Student digital QR passes, geofenced roll-call, and live session verification.",
      },
      { property: "og:title", content: "Qmark — Attendance, verified instantly." },
      {
        property: "og:description",
        content: "Student digital QR passes, geofenced roll-call, and live session verification.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.jpg" },
      { property: "og:image:secure_url", content: "/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-image.jpg" },
    ],
  }),
  component: LaunchAndGatewayPage,
});

type ScreenState = "launch" | "gateway";

function LaunchAndGatewayPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<ScreenState>("launch");
  const [hasLecturerSession, setHasLecturerSession] = useState(false);
  const [lecturerEmail, setLecturerEmail] = useState<string | null>(null);

  useEffect(() => {
    // If the user previously logged into a gateway and did not sign out, keep them logged in and take them straight to dashboard!
    const activeGateway = typeof window !== "undefined" ? localStorage.getItem("qroll_active_gateway") : null;
    const hasStudentSession = typeof window !== "undefined" && Boolean(localStorage.getItem("qroll_student_session"));
    const isLoggedOut = typeof window !== "undefined" && localStorage.getItem("qroll_logged_out") === "true";

    if (!isLoggedOut && activeGateway === "student" && hasStudentSession) {
      navigate({ to: "/student", replace: true });
      return;
    }

    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setHasLecturerSession(true);
        setLecturerEmail(user.email || user.displayName || "Lecturer");
        const gateway = typeof window !== "undefined" ? localStorage.getItem("qroll_active_gateway") : null;
        const loggedOut = typeof window !== "undefined" && localStorage.getItem("qroll_logged_out") === "true";
        if (!loggedOut && (gateway === "lecturer" || !gateway)) {
          localStorage.setItem("qroll_active_gateway", "lecturer");
          localStorage.setItem("qroll_lecturer_logged_in", "true");
          navigate({ to: "/dashboard", replace: true });
        }
      } else {
        setHasLecturerSession(false);
        setLecturerEmail(null);
      }
    });

    // Auto transition launch splash after 1.8s
    const timer = setTimeout(() => {
      setScreen("gateway");
    }, 1800);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [navigate]);

  const handleSelectRole = (role: "student" | "lecturer") => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("qroll_logged_out");
      localStorage.setItem("qroll_active_gateway", role);
    }
    if (role === "student") {
      navigate({ to: "/student" });
    } else {
      if (hasLecturerSession) {
        navigate({ to: "/dashboard" });
      } else {
        navigate({ to: "/auth" });
      }
    }
  };

  const handleSignOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("qroll_active_gateway");
      localStorage.removeItem("qroll_lecturer_logged_in");
      localStorage.setItem("qroll_logged_out", "true");
    }
    await firebaseAuth.signOut();
    setHasLecturerSession(false);
    setLecturerEmail(null);
  };

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground flex flex-col justify-between overflow-x-clip font-sans transition-colors pt-0 mt-0">
      <AnimatePresence mode="wait">
        {screen === "launch" ? (
          /* ============================================================== */
          /* 1. ANIMATED LAUNCH SCREEN (NAVY & GOLD INSTITUTIONAL SPLASH)   */
          /* ============================================================== */
          <motion.div
            key="launch-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35 }}
            onClick={() => setScreen("gateway")}
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-50 flex flex-col items-center justify-center pt-0 px-4 sm:px-6 pb-6 bg-[#0A1F44] text-white cursor-pointer select-none m-0"
          >
            {/* Subtle Ambient Radial Halo */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 320px 320px at 50% 45%, rgba(184,134,27,0.12) 0%, transparent 70%)",
              }}
            />

            <div className="relative flex flex-col items-center">
              {/* Qmark Animated SVG Mark */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="mb-6"
              >
                <svg
                  viewBox="0 0 100 100"
                  width="96"
                  height="96"
                  fill="none"
                  style={{ overflow: "visible" }}
                >
                  <circle cx="46" cy="44" r="38" fill="#B8861B" opacity="0.1" />

                  {/* Golden Center Ring */}
                  <motion.circle
                    cx="46"
                    cy="44"
                    r="26"
                    stroke="#B8861B"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                  />

                  {/* QR Corner Brackets */}
                  <motion.path
                    d="M 18 32 L 18 22 L 28 22"
                    stroke="#B8861B"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  />
                  <motion.path
                    d="M 64 22 L 74 22 L 74 32"
                    stroke="#B8861B"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                  />
                  <motion.path
                    d="M 18 56 L 18 66 L 28 66"
                    stroke="#B8861B"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                  />

                  {/* Verification Checkmark */}
                  <motion.path
                    d="M 58 58 L 68 70 L 88 46"
                    stroke="#B8861B"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.45 }}
                  />
                </svg>
              </motion.div>

              {/* Wordmark */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-center"
              >
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                  Q<span className="text-[#E2BD56]">mark</span>
                </h1>
              </motion.div>

              {/* Rule & Tagline */}
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                className="mt-4 flex flex-col items-center gap-2 w-60"
              >
                <div
                  className="h-[1.5px] w-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, #B8861B 20%, #B8861B 80%, transparent)",
                  }}
                />
                <span
                  className="text-xs font-semibold tracking-[0.14em] uppercase text-center"
                  style={{ color: "rgba(226,189,86,0.9)" }}
                >
                  Attendance, verified instantly.
                </span>
              </motion.div>
            </div>

            {/* Bottom Progress Loader & Skip Hint */}
            <div className="absolute bottom-10 flex flex-col items-center gap-2">
              <div className="h-1 w-28 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "0%" }}
                  transition={{ duration: 1.8, ease: "easeInOut" }}
                  className="h-full w-full bg-[#B8861B]"
                />
              </div>
              <span className="text-[11px] text-white/50 font-medium">Tap anywhere to enter</span>
            </div>
          </motion.div>
        ) : (
          /* ============================================================== */
          /* 2. GATEWAY SCREEN WITH DASHBOARD TITLE BAR & SLEEK COMPACT UI  */
          /* ============================================================== */
          <motion.div
            key="gateway-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col justify-between w-full min-w-0"
          >
            {/* Same Title Bar Design Used Across Dashboard Pages */}
            <QmarkTitleBar
              tag="PORTAL"
              user={
                hasLecturerSession && lecturerEmail
                  ? {
                      name: lecturerEmail.split("@")[0],
                      email: lecturerEmail,
                      role: "Faculty",
                    }
                  : null
              }
              onSignOut={hasLecturerSession ? handleSignOut : undefined}
              showBack={false}
            />

            {/* Main Portal Content Container (Balanced, Not Oversized) */}
            <main className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 min-w-0">
              {/* Header Headline */}
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wider uppercase mb-2 bg-[#B8861B]/15 text-[#B8861B] dark:text-[#E2BD56] border border-[#B8861B]/30 shadow-2xs">
                  ATTENDANCE PORTAL
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0A1F44] dark:text-white">
                  Welcome to Qmark
                </h1>
                <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                  Instant QR verification, digital student passes, and live classroom sessions.
                </p>
              </div>

              {/* Compact, Proportionate Portal Cards (Redesigned: Sleek & Non-Oversized) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                {/* 1. STUDENT PORTAL CARD */}
                <motion.div
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectRole("student")}
                  className="group relative p-4 sm:p-4.5 rounded-2xl glass-card border border-[#B8861B]/30 hover:border-[#B8861B] hover:shadow-gold transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#B8861B]/10 rounded-full blur-xl pointer-events-none group-hover:bg-[#B8861B]/15 transition-all" />

                  <div>
                    {/* Top Row: Icon Badge & Status Pill */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="size-10 rounded-xl bg-[#0A1F44] text-[#E2BD56] dark:bg-[#132C57] dark:text-[#E2BD56] flex items-center justify-center shrink-0 border border-[#B8861B]/30 shadow-2xs transition-transform group-hover:scale-105">
                        <GraduationCap className="size-5" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#B8861B]/15 text-[#B8861B] dark:text-[#E2BD56] border border-[#B8861B]/30">
                        STUDENT
                      </span>
                    </div>

                    {/* Title & Concise Summary */}
                    <h2 className="text-base sm:text-lg font-bold text-[#0A1F44] dark:text-white group-hover:text-[#B8861B] transition-colors">
                      Student Portal
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      Access your Digital QR Pass, monitor attendance rates, and submit excuses.
                    </p>

                    {/* Minimal Feature Tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100/90 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 flex items-center gap-1">
                        <QrCode className="size-2.5 text-[#B8861B]" />
                        QR Pass
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100/90 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 flex items-center gap-1">
                        <CalendarCheck className="size-2.5 text-[#B8861B]" />
                        Standing
                      </span>
                    </div>
                  </div>

                  {/* Compact Bottom Action Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between text-xs font-bold text-[#0A1F44] dark:text-[#E2BD56]">
                    <span>Enter with Index</span>
                    <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>

                {/* 2. LECTURER & FACULTY PORTAL CARD */}
                <motion.div
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectRole("lecturer")}
                  className="group relative p-4 sm:p-4.5 rounded-2xl glass-card border border-[#B8861B]/30 hover:border-[#B8861B] hover:shadow-gold transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#0A1F44]/08 dark:bg-[#B8861B]/10 rounded-full blur-xl pointer-events-none group-hover:bg-[#B8861B]/15 transition-all" />

                  <div>
                    {/* Top Row: Icon Badge & Status Pill */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="size-10 rounded-xl bg-[#0A1F44] text-[#E2BD56] dark:bg-[#132C57] dark:text-[#E2BD56] flex items-center justify-center shrink-0 border border-[#B8861B]/30 shadow-2xs transition-transform group-hover:scale-105">
                        <Building2 className="size-5" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#0A1F44]/10 dark:bg-white/10 text-[#0A1F44] dark:text-slate-200 border border-slate-200/80 dark:border-white/10">
                        FACULTY
                      </span>
                    </div>

                    {/* Title & Concise Summary */}
                    <h2 className="text-base sm:text-lg font-bold text-[#0A1F44] dark:text-white group-hover:text-[#B8861B] transition-colors">
                      Lecturer Portal
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      Start classroom sessions, verify student QR check-ins, and export reports.
                    </p>

                    {/* Minimal Feature Tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100/90 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 flex items-center gap-1">
                        <MapPin className="size-2.5 text-[#B8861B]" />
                        Geofenced
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100/90 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 flex items-center gap-1">
                        <FileSpreadsheet className="size-2.5 text-[#B8861B]" />
                        Rosters
                      </span>
                    </div>
                  </div>

                  {/* Compact Bottom Action Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between text-xs font-bold text-[#0A1F44] dark:text-[#E2BD56]">
                    <span>{hasLecturerSession ? "Open Dashboard" : "Faculty Sign In"}</span>
                    <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              </div>

              {/* Browser-Aware Direct Add to Home Screen Component */}
              <AddToHomeScreenBanner />
            </main>

            {/* Bottom Subtle Institutional Footer */}
            <footer className="py-3 px-4 text-center text-[11px] text-muted-foreground">
              Qmark • Institutional Roll-Call & Instant QR Verification
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
