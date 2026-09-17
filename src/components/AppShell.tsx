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
} from "lucide-react";
import { motion } from "motion/react";
import { firebaseAuth } from "@/integrations/firebase/config";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { KnustEmblem } from "@/components/KnustEmblem";
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
      <div className="relative flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full backdrop-blur-2xl sm:backdrop-blur-3xl bg-white/45 dark:bg-slate-950/45 border border-white/60 dark:border-white/15 shadow-[0_16px_45px_-8px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-black/5 dark:ring-white/10">
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
                  ? "bg-gradient-to-tr from-[#00381c] via-[#00552b] to-[#007a3d] text-white ring-4 ring-primary/30 shadow-primary/35 scale-105"
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

      <main className="flex-1 min-w-0 bg-background flex flex-col relative">
        {/* Header navigation */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 py-2.5 border-b bg-background/95 backdrop-blur shadow-xs">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <Link
              to={"/dashboard" as string}
              className="flex items-center gap-2 sm:gap-2.5 min-w-0 group"
            >
              <div className="size-8 sm:size-10 rounded-xl bg-primary/10 p-1 shadow-sm ring-1 ring-primary/20 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                <KnustEmblem size={28} />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-base font-bold tracking-tight leading-none text-foreground truncate">
                  KNUST-ATTENDANCE-APP
                </div>
                <div className="text-[10px] text-muted-foreground hidden sm:block tracking-wide uppercase font-semibold">
                  Attendance System
                </div>
              </div>
            </Link>

            {/* Back Button & Home Button (Required on every page) */}
            <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2 pl-1.5 sm:pl-2.5 border-l border-border/70 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) {
                    window.history.back();
                  } else {
                    navigate({ to: "/dashboard" });
                  }
                }}
                aria-label="Go Back"
                className="h-8 px-2 sm:px-2.5 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-lg"
                title="Go back to previous page"
              >
                <ArrowLeft className="size-4 shrink-0" />
                <span className="hidden xs:inline">Back</span>
              </Button>
              <Link to={"/dashboard" as string}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Home Dashboard"
                  className="h-8 px-2 sm:px-2.5 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-lg"
                  title="Dashboard Home"
                >
                  <Home className="size-4 shrink-0" />
                  <span className="hidden xs:inline">Home</span>
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link to={"/account" as string}>
              <Button
                variant="ghost"
                size="sm"
                aria-label="My Account"
                className="h-8 px-2 sm:px-2.5 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-lg"
                title="My Account"
              >
                <UserCheck className="size-4 shrink-0 text-[#00552b] dark:text-emerald-400" />
                <span className="hidden sm:inline">My Account</span>
              </Button>
            </Link>
            <Link to={"/settings" as string}>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Settings"
                className="h-8 px-2 sm:px-2.5 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-lg"
                title="Settings"
              >
                <Settings className="size-4 shrink-0" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </Link>
            {user?.id && <InAppNotificationCenter userId={user.id} />}
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              aria-label="Sign out"
              className="text-xs h-8 px-2 sm:px-2.5 font-medium"
            >
              <LogOut className="size-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        {/* Content area: well-proportioned responsive container with bottom padding for floating nav */}
        <div className="flex-1 w-full max-w-[1400px] mx-auto p-3.5 sm:p-6 lg:p-8 pb-32 sm:pb-36 min-w-0">
          {children}
        </div>

        {/* Tutor Dynamic Animated Quick Access Floating Bar */}
        <TutorFloatingNav />
      </main>
    </div>
  );
}
