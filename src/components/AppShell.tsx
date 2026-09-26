import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LogOut,
  CalendarClock,
  ScanLine,
  FileBarChart,
  Settings,
  Megaphone,
  ArrowLeft,
  Home,
  UserCheck,
  ArrowLeftRight,
} from "lucide-react";
import { motion } from "motion/react";
import { firebaseAuth } from "@/integrations/firebase/config";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { QmarkLogo } from "@/components/QmarkLogo";
import { QmarkTitleBar } from "@/components/QmarkTitleBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  registerOrVerifyDevice,
  getDeviceId,
  listenToDeviceStatus,
  type UserDevice,
} from "@/lib/device-manager";
import { DeviceLimitDialog } from "@/components/DeviceLimitDialog";
import { InAppNotificationCenter } from "@/components/PushNotificationManager";
import { toast } from "sonner";
import { clearUserAppCache } from "@/lib/query-client";

function TutorFloatingNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const leftItems = [
    { to: "/scan", label: "Scanner", icon: ScanLine },
    { to: "/sessions", label: "Sessions", icon: CalendarClock },
  ];

  const rightItems = [
    { to: "/reports", label: "Reports", icon: FileBarChart },
    { to: "/announcements", label: "Announcements", icon: Megaphone },
  ];

  const isHomeActive = pathname === "/dashboard";

  return (
    <motion.nav
      initial={{ y: 80, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="fixed bottom-3.5 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] pointer-events-auto select-none"
      aria-label="Tutor Quick Access Navigation"
    >
      <div className="relative flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full backdrop-blur-2xl sm:backdrop-blur-3xl bg-neutral-500/15 dark:bg-neutral-800/25 border border-neutral-400/25 dark:border-neutral-700/30 shadow-[0_16px_45px_-8px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.25)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.1)] ring-1 ring-neutral-900/5 dark:ring-white/10">
        {/* Left items: Scanner, Sessions */}
        {leftItems.map((item) => {
          const isActive = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to as string} className="relative group">
              <motion.div
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`relative flex flex-col items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/10"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="floating-nav-indicator"
                    className="absolute inset-0 rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/30 shadow-xs"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="size-5 sm:size-5.5 shrink-0 z-10 transition-transform group-hover:scale-110" />
                <span className="text-[10px] sm:text-xs font-semibold leading-tight mt-0.5 tracking-tight z-10 hidden xs:inline">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}

        {/* Center item: Home (Dashboard) */}
        <Link to={"/dashboard" as string} className="relative group mx-0.5 sm:mx-1.5">
          <motion.div
            whileHover={{ scale: 1.1, y: -3 }}
            whileTap={{ scale: 0.92 }}
            className="relative flex flex-col items-center justify-center cursor-pointer"
          >
            <div
              className={`size-[48px] sm:size-[56px] rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 ${
                isHomeActive
                  ? "bg-[#0A1F44] text-[#D4AF37] ring-4 ring-[#D4AF37]/40 shadow-xl scale-105"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/25"
              }`}
            >
              <Home className="size-5 sm:size-6 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-bold leading-none mt-0.5 tracking-tight">
                Home
              </span>
            </div>
          </motion.div>
        </Link>

        {/* Right items: Reports, Announcements */}
        {rightItems.map((item) => {
          const isActive = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to as string} className="relative group">
              <motion.div
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`relative flex flex-col items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/10"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="floating-nav-indicator"
                    className="absolute inset-0 rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/30 shadow-xs"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="size-5 sm:size-5.5 shrink-0 z-10 transition-transform group-hover:scale-110" />
                <span className="text-[10px] sm:text-xs font-semibold leading-tight mt-0.5 tracking-tight z-10 hidden xs:inline">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDashboard =
    pathname === "/dashboard" ||
    pathname === "/dashboard/" ||
    pathname.startsWith("/dashboard");
  const { user } = useAuth();
  const [deviceLimitOpen, setDeviceLimitOpen] = useState(false);
  const [activeDevices, setActiveDevices] = useState<UserDevice[]>([]);

  const signOut = async () => {
    clearUserAppCache();
    await firebaseAuth.signOut();
    router.navigate({ to: "/auth" });
  };

  // Enforce 4-device limit & listen for revocation
  useEffect(() => {
    if (!user?.id) return;
    const currentDeviceId = getDeviceId();

    // Register/verify this device
    registerOrVerifyDevice(user.id).then((res) => {
      if (res.limitReached) {
        setActiveDevices(res.activeDevices);
        setDeviceLimitOpen(true);
      }
    });

    // Real-time listener: if another session revoked this device, force logout
    const unsub = listenToDeviceStatus(user.id, currentDeviceId, () => {
      toast.error(
        "This device was removed from your account devices. Signed out.",
      );
      void signOut();
    });

    return () => unsub();
  }, [user?.id]);

  return (
    <div className="min-h-screen flex w-full">
      {user?.id && (
        <DeviceLimitDialog
          open={deviceLimitOpen}
          userId={user.id}
          devices={activeDevices}
          onResolved={() => setDeviceLimitOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0 bg-transparent flex flex-col relative">
        {/* Title bar matching exact screenshot design */}
        <QmarkTitleBar
          tag="GH"
          user={
            user
              ? {
                  name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Kwabena",
                  avatarUrl: user.user_metadata?.avatar_url,
                  email: user.email,
                  role: roles[0] || "Faculty",
                }
              : null
          }
          notificationUserId={user?.id}
          onSignOut={signOut}
          showBack={true}
          onBack={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              navigate({ to: "/dashboard" });
            }
          }}
          extraActions={
            !isDashboard ? (
              <Link to={"/dashboard" as string}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 sm:px-2.5 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-lg"
                  title="Dashboard Home"
                >
                  <Home className="size-4 shrink-0" />
                  <span className="hidden xs:inline">Home</span>
                </Button>
              </Link>
            ) : null
          }
        />

        {/* Content area: well-proportioned responsive container with generous bottom clearance on desktop/laptop for floating nav */}
        <div className="flex-1 w-full max-w-[1400px] mx-auto p-3.5 sm:p-6 lg:p-8 pb-32 sm:pb-36 md:pb-52 lg:pb-60 xl:pb-64 min-w-0">
          {children}
          {/* Explicit safe clearance buffer for desktop/laptop devices so bottom content is never obscured by the floating nav */}
          <div className="hidden md:block h-16 lg:h-24 w-full pointer-events-none select-none" aria-hidden="true" />
        </div>

        {/* Tutor Dynamic Animated Quick Access Floating Bar */}
        <TutorFloatingNav />
      </main>
    </div>
  );
}
