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
import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
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
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] pointer-events-auto select-none"
      aria-label="Tutor Quick Access Navigation"
    >
      {/* Real Multi-layered Glassmorphism Container with Gold Radiance */}
      <div className="relative flex items-center gap-1.5 sm:gap-3.5 px-3.5 sm:px-6 py-2.5 sm:py-3 rounded-full backdrop-blur-2xl sm:backdrop-blur-3xl bg-white/75 dark:bg-[#0A1F44]/80 border-2 border-[#D4AF37]/45 dark:border-[#D4AF37]/50 shadow-[0_20px_50px_-10px_rgba(10,31,68,0.25),0_0_0_1px_rgba(212,175,55,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)] dark:shadow-[0_25px_60px_-12px_rgba(10,31,68,0.7),0_0_0_1px_rgba(212,175,55,0.35),inset_0_1px_2px_rgba(255,255,255,0.15)] ring-1 ring-[#D4AF37]/20">
        
        {/* Subtle interior gold shimmer sheen across the pill */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent" />

        {/* Left items: Scanner, Sessions */}
        {leftItems.map((item) => {
          const isActive = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to as string} className="relative group">
              <motion.div
                whileHover={{ scale: 1.09, y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`relative flex flex-col items-center justify-center px-3.5 sm:px-4.5 py-1.5 sm:py-2 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive
                    ? "text-[#0A1F44] dark:text-[#D4AF37] font-extrabold"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#D4AF37]/15 dark:hover:bg-[#D4AF37]/20"
                }`}
              >
                {/* Golden Animated Glow Halo around active/hovered items */}
                {isActive ? (
                  <motion.div
                    layoutId="floating-nav-indicator"
                    className="absolute inset-0 rounded-full bg-gradient-to-b from-[#FEF08A]/60 via-[#F3E5AB]/40 to-transparent dark:from-[#D4AF37]/35 dark:to-[#D4AF37]/10 border border-[#D4AF37]/60 shadow-[0_0_16px_rgba(212,175,55,0.35)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : (
                  <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 ring-1 ring-[#D4AF37]/40 shadow-[0_0_12px_rgba(212,175,55,0.2)] pointer-events-none" />
                )}
                <Icon className={`size-5 sm:size-5.5 shrink-0 z-10 transition-transform duration-300 group-hover:scale-115 ${isActive ? "text-[#0A1F44] dark:text-[#D4AF37] stroke-[2.5]" : "group-hover:text-[#D4AF37]"}`} />
                <span className="text-[10px] sm:text-xs font-bold leading-tight mt-0.5 tracking-tight z-10 hidden xs:inline">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}

        {/* Center Prominent Standout Item: Home (Dashboard) */}
        <Link to={"/dashboard" as string} className="relative group mx-1 sm:mx-2.5">
          <motion.div
            whileHover={{ scale: 1.12, y: -4 }}
            whileTap={{ scale: 0.94 }}
            className="relative flex flex-col items-center justify-center cursor-pointer"
          >
            {/* Ambient Pulsing Gold Glow beneath Home */}
            <div className={`absolute -inset-1 rounded-full blur-md transition-all duration-300 ${
              isHomeActive
                ? "bg-[#D4AF37]/60 opacity-100 animate-pulse"
                : "bg-[#D4AF37]/30 opacity-60 group-hover:opacity-100"
            }`} />

            <div
              className={`relative size-[52px] sm:size-[62px] rounded-full flex flex-col items-center justify-center transition-all duration-300 ${
                isHomeActive
                  ? "bg-gradient-to-br from-[#0A1F44] via-[#0E2858] to-[#0A1F44] text-[#D4AF37] ring-4 ring-[#D4AF37] shadow-[0_8px_25px_rgba(212,175,55,0.45)] scale-105"
                  : "bg-gradient-to-br from-[#0A1F44] to-[#112A59] text-white hover:text-[#D4AF37] ring-2 ring-[#D4AF37]/60 hover:ring-[#D4AF37] shadow-lg hover:shadow-[0_8px_22px_rgba(212,175,55,0.35)]"
              }`}
            >
              <Home className={`size-5 sm:size-6.5 shrink-0 transition-transform group-hover:scale-110 ${isHomeActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-[9px] sm:text-[10px] font-extrabold leading-none mt-0.5 tracking-tight uppercase">
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
                whileHover={{ scale: 1.09, y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`relative flex flex-col items-center justify-center px-3.5 sm:px-4.5 py-1.5 sm:py-2 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive
                    ? "text-[#0A1F44] dark:text-[#D4AF37] font-extrabold"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#D4AF37]/15 dark:hover:bg-[#D4AF37]/20"
                }`}
              >
                {/* Golden Animated Glow Halo around active/hovered items */}
                {isActive ? (
                  <motion.div
                    layoutId="floating-nav-indicator"
                    className="absolute inset-0 rounded-full bg-gradient-to-b from-[#FEF08A]/60 via-[#F3E5AB]/40 to-transparent dark:from-[#D4AF37]/35 dark:to-[#D4AF37]/10 border border-[#D4AF37]/60 shadow-[0_0_16px_rgba(212,175,55,0.35)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : (
                  <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 ring-1 ring-[#D4AF37]/40 shadow-[0_0_12px_rgba(212,175,55,0.2)] pointer-events-none" />
                )}
                <Icon className={`size-5 sm:size-5.5 shrink-0 z-10 transition-transform duration-300 group-hover:scale-115 ${isActive ? "text-[#0A1F44] dark:text-[#D4AF37] stroke-[2.5]" : "group-hover:text-[#D4AF37]"}`} />
                <span className="text-[10px] sm:text-xs font-bold leading-tight mt-0.5 tracking-tight z-10 hidden xs:inline">
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
  const { user, roles } = useAuth();
  const [deviceLimitOpen, setDeviceLimitOpen] = useState(false);
  const [activeDevices, setActiveDevices] = useState<UserDevice[]>([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Notification prompt check: ONLY appears once after initial signup for the first time on this device
  useEffect(() => {
    if (!user?.id) return;
    try {
      const isJustSignedUp = sessionStorage.getItem("qmark_just_signed_up") === "true";
      const promptShownDevice =
        localStorage.getItem(`qmark_notification_prompt_shown_${user.id}`) ||
        localStorage.getItem("qmark_notification_prompt_shown_global");
      const permGranted = typeof Notification !== "undefined" && Notification.permission === "granted";

      if (isJustSignedUp && !promptShownDevice && !permGranted) {
        sessionStorage.removeItem("qmark_just_signed_up");
        const timer = setTimeout(() => {
          setShowNotificationModal(true);
        }, 800);
        return () => clearTimeout(timer);
      } else if (isJustSignedUp) {
        sessionStorage.removeItem("qmark_just_signed_up");
      }
    } catch {
      // Ignore
    }
  }, [user?.id]);

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
        <>
          <DeviceLimitDialog
            open={deviceLimitOpen}
            userId={user.id}
            devices={activeDevices}
            onResolved={() => setDeviceLimitOpen(false)}
          />
          <NotificationPermissionModal
            open={showNotificationModal}
            onClose={() => setShowNotificationModal(false)}
            userContext={{
              userId: user.id,
              userRole: "lecturer",
            }}
          />
        </>
      )}

      <main className="flex-1 min-w-0 bg-transparent flex flex-col relative pt-0 mt-0">
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
