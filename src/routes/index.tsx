import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  GraduationCap,
  Building2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { AddToHomeScreenBanner } from "@/components/AddToHomeScreenBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { firebaseAuth, onAuthStateChanged } from "@/integrations/firebase/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Qmark — Next-Gen Campus Roll-Call & Attendance" },
      {
        name: "description",
        content:
          "Qmark: Ultra-fast campus attendance verification. Student digital QR passes, hardware-accelerated scanning, geofenced roll-call, and live session analytics.",
      },
      { property: "og:title", content: "Qmark — Attendance, verified instantly." },
      {
        property: "og:description",
        content: "Student digital QR passes, hardware-accelerated scanning, geofenced roll-call, and live session verification.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [hasLecturerSession, setHasLecturerSession] = useState(false);
  const [lecturerEmail, setLecturerEmail] = useState<string | null>(null);

  useEffect(() => {
    // If user previously chose a portal and hasn't explicitly signed out, route accordingly
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

    return () => {
      unsub();
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
    <div className="relative min-h-screen w-full bg-slate-50/80 dark:bg-[#040e1e] text-foreground flex flex-col justify-between overflow-x-clip select-none transition-colors">
      {/* Dynamic Background: Ambient Glows & Subtle Architectural Grid for Real Glass Depth */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #D4AF37 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div
          className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#D4AF37]/20 to-[#B8861B]/15 blur-[120px] animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-1/3 -right-20 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-[#0A1F44]/15 dark:from-[#0d346b]/45 to-transparent blur-[140px]"
        />
        <div
          className="absolute -bottom-32 left-10 w-[600px] h-[600px] rounded-full bg-[#D4AF37]/15 dark:bg-[#D4AF37]/10 blur-[150px]"
        />
      </div>

      {/* Top Header Bar with Glass Styling & Gold Rim */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-white/40 dark:bg-[#07162b]/55 border-b border-[#D4AF37]/30 shadow-[0_4px_24px_rgba(10,31,68,0.04)]">
        <div className="w-full max-w-7xl lg:max-w-[96vw] xl:max-w-[98vw] 2xl:max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="size-10 rounded-xl bg-white/60 dark:bg-white/10 border-2 border-[#D4AF37]/60 p-1.5 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform backdrop-blur-md">
              <img src="/qmark-logo.svg" alt="Qmark Logo" className="size-full object-contain" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#0A1F44] dark:text-white leading-none">
                Qmark
              </span>
              <p className="text-[9px] font-extrabold tracking-widest text-[#B8861B] dark:text-[#E2BD56] uppercase mt-0.5">
                Attendance Platform
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase backdrop-blur-md bg-white/40 dark:bg-white/05 text-[#0A1F44] dark:text-[#E2BD56] border border-[#D4AF37]/35 shadow-xs">
              <ShieldCheck className="size-3.5 text-[#B8861B]" />
              Verified Institutional Gateway
            </span>

            {hasLecturerSession && (
              <button
                type="button"
                onClick={handleSignOut}
                className="hidden sm:inline-flex text-xs font-semibold text-destructive hover:underline px-2 cursor-pointer"
              >
                Sign Out ({lecturerEmail?.split("@")[0]})
              </button>
            )}

            <ThemeToggle className="hover:bg-[#D4AF37]/10 border border-[#D4AF37]/30" />
          </div>
        </div>
      </header>

      {/* Main Content Area: Simplified, focused layout with 2 Gateways + Install Banner */}
      <main className="flex-1 flex flex-col justify-center w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-7 sm:space-y-8">
        {/* Simple Title Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#0A1F44] dark:text-white leading-[1.1]">
            Attendance, <span className="bg-gradient-to-r from-[#B8861B] via-[#E2BD56] to-[#B8861B] bg-clip-text text-transparent">Verified Instantly.</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-medium leading-relaxed">
            Select your institutional portal below to access your digital student pass or manage lecture sessions.
          </p>
        </div>

        {/* The 2 Primary Gateways: Clean, Elegant, Glass-Like Containers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full items-stretch">
          {/* 1. STUDENT GATEWAY */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            whileHover={{ y: -4 }}
            onClick={() => handleSelectRole("student")}
            className="group relative rounded-2xl p-5 sm:p-6 backdrop-blur-3xl bg-white/[0.12] dark:bg-[#0A1F44]/25 border-2 border-[#D4AF37]/50 hover:border-[#D4AF37] shadow-[0_20px_50px_-15px_rgba(10,31,68,0.12),inset_0_1px_2px_rgba(255,255,255,0.4)] transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Top gold edge sheen */}
            <div className="pointer-events-none absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-90" />
            <div className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full bg-[#D4AF37]/15 blur-2xl group-hover:scale-125 transition-transform" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-11 rounded-xl backdrop-blur-xl bg-white/40 dark:bg-white/10 border-2 border-[#D4AF37]/60 flex items-center justify-center text-[#0A1F44] dark:text-[#E2BD56] shadow-sm group-hover:scale-105 transition-transform">
                  <GraduationCap className="size-5" />
                </div>
                <span className="px-3 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase backdrop-blur-md bg-[#D4AF37]/20 text-[#0A1F44] dark:text-[#E2BD56] border border-[#D4AF37]/50 shadow-xs">
                  STUDENT PORTAL
                </span>
              </div>

              <div className="space-y-1 pt-1">
                <h2 className="text-xl sm:text-2xl font-black text-[#0A1F44] dark:text-white group-hover:text-[#B8861B] dark:group-hover:text-[#E2BD56] transition-colors">
                  Student Portal
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Access your personal QR attendance badge, inspect course attendance standing, and view class timetables.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#D4AF37]/30 flex items-center justify-between">
              <span className="text-sm font-extrabold text-[#0A1F44] dark:text-[#E2BD56]">
                Enter Student Portal
              </span>
              <div className="size-9 rounded-full backdrop-blur-md bg-white/50 dark:bg-white/10 border-2 border-[#D4AF37]/70 flex items-center justify-center text-[#0A1F44] dark:text-[#E2BD56] group-hover:translate-x-1.5 group-hover:border-[#D4AF37] transition-all shadow-sm">
                <ArrowRight className="size-4" />
              </div>
            </div>
          </motion.div>

          {/* 2. LECTURER & FACULTY GATEWAY */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            whileHover={{ y: -4 }}
            onClick={() => handleSelectRole("lecturer")}
            className="group relative rounded-2xl p-5 sm:p-6 backdrop-blur-3xl bg-white/[0.12] dark:bg-[#0A1F44]/25 border-2 border-[#D4AF37]/50 hover:border-[#D4AF37] shadow-[0_20px_50px_-15px_rgba(10,31,68,0.12),inset_0_1px_2px_rgba(255,255,255,0.4)] transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Top gold edge sheen */}
            <div className="pointer-events-none absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-90" />
            <div className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full bg-[#0A1F44]/20 dark:bg-[#D4AF37]/15 blur-2xl group-hover:scale-125 transition-transform" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-11 rounded-xl backdrop-blur-xl bg-white/40 dark:bg-white/10 border-2 border-[#D4AF37]/60 flex items-center justify-center text-[#0A1F44] dark:text-[#E2BD56] shadow-sm group-hover:scale-105 transition-transform">
                  <Building2 className="size-5" />
                </div>
                <span className="px-3 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase backdrop-blur-md bg-[#0A1F44]/15 dark:bg-white/10 text-[#0A1F44] dark:text-slate-200 border border-[#D4AF37]/40 shadow-xs">
                  FACULTY SUITE
                </span>
              </div>

              <div className="space-y-1 pt-1">
                <h2 className="text-xl sm:text-2xl font-black text-[#0A1F44] dark:text-white group-hover:text-[#B8861B] dark:group-hover:text-[#E2BD56] transition-colors">
                  Faculty Portal
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Start lecture roll calls, run high-speed camera verification of student badges, and export accredited attendance reports.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#D4AF37]/30 flex items-center justify-between">
              <span className="text-sm font-extrabold text-[#0A1F44] dark:text-[#E2BD56]">
                {hasLecturerSession ? "Go to Dashboard" : "Faculty Sign In"}
              </span>
              <div className="size-9 rounded-full backdrop-blur-md bg-white/50 dark:bg-white/10 border-2 border-[#D4AF37]/70 flex items-center justify-center text-[#0A1F44] dark:text-[#E2BD56] group-hover:translate-x-1.5 group-hover:border-[#D4AF37] transition-all shadow-sm">
                <ArrowRight className="size-4" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* PWA Home Screen Installation Capsule */}
        <div className="pt-2">
          <AddToHomeScreenBanner />
        </div>
      </main>

      {/* Institutional Glass Footer */}
      <footer className="py-4 px-6 border-t border-[#D4AF37]/25 backdrop-blur-2xl bg-white/30 dark:bg-[#07162b]/50 text-center text-xs text-muted-foreground">
        <div className="w-full max-w-7xl lg:max-w-[96vw] xl:max-w-[98vw] 2xl:max-w-[1850px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-medium">Qmark • Next-Generation Academic Attendance Platform</span>
          <div className="flex items-center gap-4 text-[11px]">
            <Link to="/manual" className="hover:text-foreground font-semibold transition-colors">
              User Manual
            </Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
