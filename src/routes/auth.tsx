import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
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
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
  const [showPassword, setShowPassword] = useState(false);
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setEmailLoading(true);

    try {
      if (tab === "signin") {
        const userCred = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
        await syncUserToFirestore(userCred.user);
        localStorage.setItem("qroll_active_gateway", "lecturer");
        localStorage.setItem("qroll_lecturer_logged_in", "true");
        localStorage.removeItem("qroll_logged_out");
        toast.success("Signed in successfully");
        navigate({ to: "/dashboard" });
      } else {
        const userCred = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password);
        await syncUserToFirestore(userCred.user);
        localStorage.setItem("qroll_active_gateway", "lecturer");
        localStorage.setItem("qroll_lecturer_logged_in", "true");
        localStorage.removeItem("qroll_logged_out");
        toast.success("Account created successfully");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      console.error("Email auth error:", err);
      const msg =
        err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential"
          ? "Invalid email or password"
          : err?.code === "auth/email-already-in-use"
            ? "An account with this email already exists"
            : err?.code === "auth/weak-password"
              ? "Password should be at least 6 characters"
              : err?.message || "Authentication failed";
      toast.error(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first");
      return;
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase());
      toast.success("Password reset email sent. Check your inbox.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reset email");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Bar */}
      <header className="px-4 sm:px-8 py-4 flex items-center justify-between border-b border-border">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition">
          <ArrowLeft className="size-4" />
          <span className="text-xs font-semibold">Back to Home</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-md border border-border bg-card shadow-sm rounded-2xl">
          <CardHeader className="text-center pb-3 pt-6">
            <div className="mx-auto size-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mb-3">
              <ShieldCheck className="size-6 text-[#E2BD56]" />
            </div>
            <CardTitle className="text-xl font-bold">Faculty Portal</CardTitle>
            <CardDescription className="text-xs">
              Manage classes, sessions, and verified attendance.
            </CardDescription>

            {/* Mode switch */}
            <div className="grid grid-cols-2 p-1 bg-muted rounded-xl mt-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTab("signin")}
                className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                  tab === "signin" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                  tab === "signup" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground"
                }`}
              >
                Create Account
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-6 pb-6">
            {/* Google Sign In */}
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              variant="outline"
              className="w-full h-10 font-semibold text-xs border border-border flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Connecting Google...</span>
                </>
              ) : (
                <>
                  <svg className="size-4" viewBox="0 0 24 24">
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

            <div className="relative flex items-center justify-center">
              <span className="w-full border-t border-border" />
              <span className="absolute bg-card px-2 text-[10px] uppercase font-semibold text-muted-foreground">
                Or with email
              </span>
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Institutional Email</Label>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="lecturer@institution.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 text-xs pl-8"
                    required
                  />
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold">Password</Label>
                  {tab === "signin" && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 text-xs pl-8 pr-8"
                    required
                  />
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={emailLoading}
                className="w-full h-9 font-bold text-xs mt-2 cursor-pointer"
              >
                {emailLoading
                  ? "Please wait..."
                  : tab === "signin"
                    ? "Sign In with Email"
                    : "Create Faculty Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
