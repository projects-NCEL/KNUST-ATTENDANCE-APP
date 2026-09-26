import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
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
  Mail,
  Lock,
  Radio,
  BookOpen,
  Calendar,
  Users,
  BarChart2,
} from "lucide-react";
import { QmarkLogo } from "@/components/QmarkLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Lecturer Sign In — Qmark" },
      {
        name: "description",
        content: "Lecturer and staff portal for Qmark. Manage courses, live roll calls, and grades.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setEmailLoading(true);
    try {
      if (tab === "signin") {
        const userCred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await syncUserToFirestore(userCred.user);
        toast.success("Signed in successfully");
        navigate({ to: "/dashboard" });
      } else {
        const userCred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await syncUserToFirestore(userCred.user);
        toast.success("Account created successfully");
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj.code === "auth/user-not-found" || errorObj.code === "auth/wrong-password" || errorObj.code === "auth/invalid-credential") {
        toast.error("Invalid email or password");
      } else if (errorObj.code === "auth/email-already-in-use") {
        toast.error("An account already exists with this email. Please sign in.");
      } else {
        toast.error(errorObj.message || "Authentication failed");
      }
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-[#0A1F44] dark:text-[#F2F2F2] flex flex-col justify-between font-sans transition-colors">
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <QmarkLogo size="sm" variant="full" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-[#0A1F44] dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Gateway</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/35 shadow-xl">
          {/* Logo & Headline matching HTML 2 */}
          <div className="flex flex-col items-center text-center mb-6">
            <QmarkLogo size="lg" variant="icon" />
            <div
              className="mt-3 text-[11px] font-bold tracking-[0.12em] uppercase"
              style={{ color: "#D4AF37" }}
            >
              LECTURER PORTAL
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-[#0A1F44] dark:text-white">
              {tab === "signin" ? "Lecturer sign in" : "Create lecturer account"}
            </h1>
            <p className="mt-1 text-xs text-[#8891A4] dark:text-neutral-300">
              Staff access only. Students use the student portal.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex rounded-full bg-[#F4F4F6] dark:bg-white/5 p-1 mb-6 border border-[#E4E4EC] dark:border-white/10">
            <button
              type="button"
              onClick={() => setTab("signin")}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                tab === "signin"
                  ? "bg-white dark:bg-[#061631] text-[#0A1F44] dark:text-white shadow-xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                tab === "signup"
                  ? "bg-white dark:bg-[#061631] text-[#0A1F44] dark:text-white shadow-xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 ml-3">
                Staff Email
              </label>
              <div className="flex items-center gap-3 px-4 py-3 rounded-full border border-[#E4E4EC] dark:border-white/15 bg-[#FAFAFA] dark:bg-white/5 focus-within:border-[#D4AF37] transition-colors">
                <Mail className="size-4 text-[#8891A4] shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="lecturer@university.edu.gh"
                  required
                  className="w-full bg-transparent text-sm text-[#0A1F44] dark:text-white outline-none placeholder:text-neutral-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 ml-3">
                Password
              </label>
              <div className="flex items-center gap-3 px-4 py-3 rounded-full border border-[#E4E4EC] dark:border-white/15 bg-[#FAFAFA] dark:bg-white/5 focus-within:border-[#D4AF37] transition-colors">
                <Lock className="size-4 text-[#8891A4] shrink-0" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-transparent text-sm text-[#0A1F44] dark:text-white outline-none placeholder:text-neutral-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={emailLoading}
              className="w-full py-3.5 rounded-full font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              style={{
                backgroundColor: "#D4AF37",
                color: "#0A1F44",
              }}
            >
              {emailLoading && <Loader2 className="size-4 animate-spin text-[#0A1F44]" />}
              <span>{tab === "signin" ? "Sign In" : "Create Account"}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#EBEBEB] dark:border-white/10" />
            </div>
            <span className="relative bg-white dark:bg-[#0A1F44] px-3 text-xs text-[#8891A4]">
              or
            </span>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-3.5 rounded-full font-bold text-sm border border-[#E4E4EC] dark:border-white/15 bg-white dark:bg-white/5 hover:bg-neutral-50 dark:hover:bg-white/10 text-[#0A1F44] dark:text-white flex items-center justify-center gap-3 transition-colors cursor-pointer"
          >
            {googleLoading ? (
              <Loader2 className="size-4 animate-spin text-neutral-500" />
            ) : (
              <svg className="size-4.5 shrink-0" viewBox="0 0 24 24">
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
            )}
            <span>Continue with Google</span>
          </button>

          {/* Link back to student portal */}
          <div className="mt-6 text-center">
            <Link
              to="/student"
              className="text-xs font-semibold text-[#8891A4] hover:text-[#0A1F44] dark:hover:text-[#D4AF37] transition-colors"
            >
              ← Looking for your Student Pass? Enter Student Portal
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
