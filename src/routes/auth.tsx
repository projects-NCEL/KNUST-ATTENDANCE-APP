import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { signInWithPopup } from "firebase/auth";
import {
  firebaseAuth,
  onAuthStateChanged,
  googleProvider,
  syncUserToFirestore,
} from "@/integrations/firebase/config";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Faculty Sign In — Qmark" },
      {
        name: "description",
        content: "Faculty and staff portal for Qmark. Manage courses, live roll calls, and attendance reports.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (firebaseAuth.currentUser) {
      navigate({ to: "/dashboard" });
      return;
    }

    const unsubFb = onAuthStateChanged(firebaseAuth, (fbUser) => {
      if (fbUser) {
        navigate({ to: "/dashboard" });
      }
    });

    return () => {
      unsubFb();
    };
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      await syncUserToFirestore(result.user);
      localStorage.setItem("qroll_active_gateway", "lecturer");
      localStorage.setItem("qroll_lecturer_logged_in", "true");
      localStorage.removeItem("qroll_logged_out");
      toast.success(`Signed in as ${result.user.displayName || result.user.email || "Lecturer"}`);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      console.error("Google sign in error:", err);
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === "auth/popup-closed-by-user") {
        toast.info("Google sign-in was cancelled.");
      } else if (errorObj?.code === "auth/popup-blocked") {
        toast.error("Google sign-in popup was blocked. Please allow popups for this site.");
      } else {
        toast.error(errorObj?.message || "Failed to sign in with Google.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#07162b] text-foreground transition-colors">
      {/* Top Bar */}
      <header className="px-4 sm:px-8 py-4 flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#07162b]/90 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition text-[#0A1F44] dark:text-white font-medium">
          <ArrowLeft className="size-4" />
          <span className="text-xs font-semibold">Back to Home</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-[#0A1F44]/80 dark:text-white/70 uppercase tracking-wider hidden sm:inline">
            University Faculty Gateway
          </span>
          <ThemeToggle className="text-[#0A1F44] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10" />
        </div>
      </header>

      {/* Main Split-Card Container: capped at ~900px so it matches the student sign-in */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-10 my-auto w-full">
        <div className="w-full max-w-4xl rounded-[22px] sm:rounded-[28px] border-2 border-[#D4AF37]/40 dark:border-[#D4AF37]/35 shadow-[0_20px_60px_-15px_rgba(10,31,68,0.18),0_0_25px_rgba(212,175,55,0.15)] bg-white dark:bg-[#0A1F44]/95 overflow-hidden grid grid-cols-1 md:grid-cols-12 md:min-h-[460px]">
          {/* LEFT COLUMN: Black Lecturers Hero Image with ultra-transparent glass styling */}
          <div className="md:col-span-6 relative overflow-hidden flex flex-col justify-between p-5 sm:p-7 text-white min-h-[220px] md:min-h-full">
            {/* Real Black Lecturer Hero Image */}
            <img
              src="/black-lecturer-hero.jpg"
              alt="Faculty Lecturer"
              className="absolute inset-0 size-full object-cover object-center filter brightness-95 contrast-105"
            />
            {/* Very transparent subtle gradient overlay so the photo is vibrant & visible */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#07162b]/85 via-black/25 to-black/10 backdrop-blur-[0.5px]" />

            {/* Top Brand Capsule */}
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="size-11 rounded-xl bg-white/25 backdrop-blur-md border border-white/40 flex items-center justify-center p-1.5 shadow-md">
                  <img src="/qmark-logo.svg" alt="Qmark" className="size-full object-contain" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-none">
                    Qmark
                  </h1>
                  <p className="text-[10px] font-bold tracking-widest text-[#FFF3B0] uppercase mt-0.5">
                    Faculty Portal
                  </p>
                </div>
              </div>

              <div className="inline-block">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-white/20 border border-white/35 px-3.5 py-1 rounded-full backdrop-blur-md shadow-xs">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                  Verified Lecturer Access
                </span>
              </div>
            </div>

            {/* Bottom Highlights */}
            <div className="relative z-10 pt-6 md:pt-0 space-y-2.5">
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight drop-shadow-sm">
                Smart Classroom Attendance & Analytics
              </h2>
              <p className="text-xs sm:text-sm text-white/95 leading-relaxed drop-shadow-sm max-w-xl">
                Real-time QR roll calls, automated attendance records, and immediate student verification.
              </p>

              <div className="space-y-2 pt-3 border-t border-white/25 text-xs sm:text-sm text-white/95">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <span>Instant student QR badge scanning</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <span>Real-time session attendance reports</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Single-Click Google Sign In */}
          <div className="md:col-span-6 p-5 sm:p-7 flex flex-col justify-between bg-white dark:bg-[#07162b]/95">
            <div className="my-auto space-y-5">
              <div className="space-y-3 text-center md:text-left">
                <div className="size-12 rounded-2xl bg-[#0A1F44]/5 dark:bg-white/10 border-2 border-[#D4AF37]/40 shadow-xs flex items-center justify-center mx-auto md:mx-0">
                  <GraduationCap className="size-6 text-[#0A1F44] dark:text-[#E2BD56]" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0A1F44] dark:text-white">
                  Faculty Sign In
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Authenticate with your institutional Google account to manage your courses, active sessions, and attendance reports.
                </p>
              </div>

              {/* Single Click Google Sign-In as requested */}
              <div className="space-y-3 pt-2">
                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full h-11 text-sm font-bold bg-white text-[#0A1F44] hover:bg-slate-50 dark:bg-white dark:text-[#0A1F44] dark:hover:bg-slate-100 border-2 border-[#D4AF37]/50 hover:border-[#D4AF37] shadow-md flex items-center justify-center gap-3 cursor-pointer rounded-xl transition-all"
                >
                  {googleLoading ? (
                    <>
                      <Loader2 className="size-5 animate-spin text-[#0A1F44]" />
                      <span>Connecting Google Account...</span>
                    </>
                  ) : (
                    <>
                      <svg className="size-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 pt-1">
                  Single-click faculty authentication with your university email.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-slate-200 dark:border-white/10 text-[11px] text-center text-slate-600 dark:text-slate-300">
              Are you a student?{" "}
              <Link to="/student" className="font-bold text-[#0A1F44] dark:text-[#E2BD56] hover:underline">
                Go to Student Pass
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
