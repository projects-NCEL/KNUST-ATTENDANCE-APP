import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Radio,
  QrCode,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  Users,
  MapPin,
  Clock,
} from "lucide-react";
import { QmarkLogo } from "@/components/QmarkLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
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
      { property: "og:image", content: "/qmark-logo.svg" },
      { name: "twitter:card", content: "summary_large_image" },
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
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setHasLecturerSession(true);
        setLecturerEmail(user.email || user.displayName || "Lecturer");
      } else {
        setHasLecturerSession(false);
        setLecturerEmail(null);
      }
    });

    // Auto transition launch splash after 2.4s
    const timer = setTimeout(() => {
      setScreen("gateway");
    }, 2400);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  const handleSelectRole = (role: "student" | "lecturer") => {
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

  return (
    <div className="relative min-h-screen w-full bg-[#F8F8FA] dark:bg-[#061631] text-[#0A1F44] dark:text-[#F2F2F2] flex flex-col justify-between overflow-x-hidden font-sans transition-colors">
      <AnimatePresence mode="wait">
        {screen === "launch" ? (
          /* ============================================================== */
          /* 1. ANIMATED LAUNCH SCREEN (NAVY & GOLD SPECIFICATION)         */
          /* ============================================================== */
          <motion.div
            key="launch-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            onClick={() => setScreen("gateway")}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#0A1F44] text-white cursor-pointer select-none"
          >
            {/* Ambient Radial Center Halo */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 320px 320px at 50% 45%, rgba(212,175,55,0.12) 0%, transparent 70%)",
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
                  width="100"
                  height="100"
                  fill="none"
                  style={{ overflow: "visible" }}
                >
                  {/* Subtle Glow Circle */}
                  <circle cx="46" cy="44" r="38" fill="#D4AF37" opacity="0.08" />

                  {/* Golden Center Ring */}
                  <motion.circle
                    cx="46"
                    cy="44"
                    r="26"
                    stroke="#D4AF37"
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
                    stroke="#D4AF37"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  />
                  <motion.path
                    d="M 64 22 L 74 22 L 74 32"
                    stroke="#D4AF37"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                  />
                  <motion.path
                    d="M 18 56 L 18 66 L 28 66"
                    stroke="#D4AF37"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                  />

                  {/* Verification Checkmark shooting out */}
                  <motion.path
                    d="M 58 58 L 68 70 L 88 46"
                    stroke="#D4AF37"
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-center"
              >
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                  Q<span style={{ color: "#D4AF37" }}>mark</span>
                </h1>
              </motion.div>

              {/* Rule & Tagline */}
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="mt-4 flex flex-col items-center gap-2.5 w-60"
              >
                <div
                  className="h-[1.5px] w-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, #D4AF37 20%, #D4AF37 80%, transparent)",
                  }}
                />
                <span
                  className="text-xs font-semibold tracking-[0.14em] uppercase text-center"
                  style={{ color: "rgba(212,175,55,0.85)" }}
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
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="h-full w-full"
                  style={{ backgroundColor: "#D4AF37" }}
                />
              </div>
              <span className="text-[11px] text-white/40 font-medium">Tap anywhere to enter</span>
            </div>
          </motion.div>
        ) : (
          /* ============================================================== */
          /* 2. CLEAN LIGHT-MODE GATEWAY SELECTION                         */
          /* ============================================================== */
          <motion.div
            key="gateway-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12"
          >
            {/* Header Navigation */}
            <header className="flex items-center justify-between pb-6 border-b border-[#E4E4EC] dark:border-white/10">
              <QmarkLogo size="md" variant="full" />

              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Link
                  to="/check-in"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#D4AF37]/15 dark:bg-[#D4AF37]/25 text-[#0A1F44] dark:text-[#D4AF37] border border-[#D4AF37]/35 hover:bg-[#D4AF37]/30 transition-all cursor-pointer"
                >
                  <QrCode className="size-3.5 text-[#D4AF37]" />
                  <span>Check In</span>
                </Link>
              </div>
            </header>

            {/* Welcome Heading */}
            <div className="mt-8 sm:mt-12 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase mb-3 bg-[#D4AF37]/15 dark:bg-[#D4AF37]/25 text-[#0A1F44] dark:text-[#D4AF37] border border-[#D4AF37]/30">
                SELECT YOUR PORTAL
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0A1F44] dark:text-white">
                Every attendance moment,<br className="hidden sm:inline" /> in one place.
              </h1>
              <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-300 max-w-md mx-auto">
                Secure QR attendance passes, geofenced classroom verification, and live course records.
              </p>
            </div>

            {/* Portal Cards Grid */}
            <div className="mt-8 sm:mt-10 grid sm:grid-cols-2 gap-4 sm:gap-6">
              {/* CARD 1: STUDENT PORTAL */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectRole("student")}
                className="group relative p-6 sm:p-7 rounded-3xl glass-card border border-[#D4AF37]/30 hover:border-[#D4AF37] hover:shadow-gold transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#D4AF37]/20 transition-all" />

                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className="size-13 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm"
                      style={{ backgroundColor: "rgba(212, 175, 55, 0.15)", color: "#0A1F44" }}
                    >
                      <BookOpen className="size-6 text-[#D4AF37]" />
                    </div>
                    <span
                      className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                      style={{ backgroundColor: "rgba(212, 175, 55, 0.15)", color: "#D4AF37", border: "1px solid rgba(212, 175, 55, 0.3)" }}
                    >
                      STUDENT
                    </span>
                  </div>

                  <h2 className="mt-5 text-xl sm:text-2xl font-bold text-[#0A1F44] dark:text-white group-hover:text-[#D4AF37] transition-colors">
                    Student Portal
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    View your Digital QR Pass, monitor attendance percentage for each course, check
                    exam eligibility, and submit absence excuses.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[#0A1F44] dark:text-neutral-200 border border-black/5 dark:border-white/10">
                      Digital QR Pass
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[#0A1F44] dark:text-neutral-200 border border-black/5 dark:border-white/10">
                      Course Standing
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[#0A1F44] dark:text-neutral-200 border border-black/5 dark:border-white/10">
                      Excuses
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#D4AF37]/20 flex items-center justify-between text-xs font-bold text-[#0A1F44] dark:text-[#D4AF37]">
                  <span>Enter with Index Number</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>

              {/* CARD 2: LECTURER & FACULTY */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectRole("lecturer")}
                className="group relative p-6 sm:p-7 rounded-3xl glass-card border border-[#D4AF37]/30 hover:border-[#D4AF37] hover:shadow-gold transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#0A1F44]/10 dark:bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#D4AF37]/20 transition-all" />

                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className="size-13 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm"
                      style={{ backgroundColor: "rgba(10,31,68,0.1)", color: "#0A1F44" }}
                    >
                      <Radio className="size-6 text-[#0A1F44] dark:text-[#D4AF37]" />
                    </div>
                    <span
                      className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider text-[#0A1F44] dark:text-[#D4AF37] bg-[rgba(10,31,68,0.08)] dark:bg-[#D4AF37]/15 border border-[#D4AF37]/30"
                    >
                      FACULTY
                    </span>
                  </div>

                  <h2 className="mt-5 text-xl sm:text-2xl font-bold text-[#0A1F44] dark:text-white group-hover:text-[#D4AF37] transition-colors">
                    Lecturer Portal
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Staff access only. Launch live broadcast sessions, verify attendance with classroom
                    geofencing, track real-time rosters, and export reports.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[#0A1F44] dark:text-neutral-200 border border-black/5 dark:border-white/10">
                      Live Sessions
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[#0A1F44] dark:text-neutral-200 border border-black/5 dark:border-white/10">
                      Geofence Radar
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[#0A1F44] dark:text-neutral-200 border border-black/5 dark:border-white/10">
                      Rosters & Grades
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#D4AF37]/20 flex items-center justify-between text-xs font-bold text-[#0A1F44] dark:text-[#D4AF37]">
                  <span>{hasLecturerSession ? `Signed in (${lecturerEmail})` : "Staff Sign In"}</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            </div>

            {/* Quick Check-in Banner */}
            <div className="mt-6 p-4 sm:p-5 rounded-3xl glass-card border border-[#D4AF37]/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div
                  className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(212, 175, 55, 0.15)", color: "#D4AF37" }}
                >
                  <MapPin className="size-5.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0A1F44] dark:text-white">
                    Need to check into a live class right now?
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Use your device GPS location to record attendance in classroom range.
                  </p>
                </div>
              </div>
              <Link
                to="/check-in"
                className="w-full sm:w-auto px-6 py-2.5 rounded-full font-bold text-xs text-center transition-all cursor-pointer shrink-0 shadow-sm hover:scale-105 bg-[#0A1F44] text-white dark:bg-[#D4AF37] dark:text-[#0A1F44] border border-[#D4AF37]/40 hover:opacity-95"
              >
                Launch Check-In
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
