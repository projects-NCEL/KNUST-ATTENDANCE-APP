import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarClock,
  ScanLine,
  FileBarChart,
  Megaphone,
  Home,
  Users,
  BookOpen,
  Settings,
  LogOut,
  X,
  User as UserIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { firebaseAuth } from "@/integrations/firebase/config";
import { useAuth } from "@/lib/auth";
import { QmarkTitleBar } from "@/components/QmarkTitleBar";
import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
import { clearUserAppCache } from "@/lib/query-client";
import { Badge } from "@/components/ui/badge";

/* ========================================================================= */
/* ULTRA-TRANSPARENT, GLASS-LIKE FLOATING NAVBAR                             */
/* (Students Directory removed, simple short terms)                          */
/* ========================================================================= */
function TutorFloatingNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Simple, short, direct terms
  const navItems = [
    { to: "/scan", label: "Scan", icon: ScanLine },
    { to: "/sessions", label: "Sessions", icon: CalendarClock },
    { to: "/dashboard", label: "Home", icon: Home, isCenter: true },
    { to: "/reports", label: "Reports", icon: FileBarChart },
    { to: "/announcements", label: "Notices", icon: Megaphone },
  ];

  return (
    <nav
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[94vw] pointer-events-auto select-none"
      aria-label="Tutor Navigation"
    >
      {/* Ultra-transparent Frosted Glass Container */}
      <div className="relative flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full backdrop-blur-3xl bg-white/45 dark:bg-[#07162b]/55 border border-white/50 dark:border-white/15 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.15),0_1px_2px_rgba(255,255,255,0.4)_inset]">
        {/* Subtle interior light reflection sheen */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

        {navItems.map((item) => {
          const isActive =
            item.to === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/dashboard/"
              : pathname.startsWith(item.to);
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <Link key={item.to} to={item.to as string} className="relative group mx-1">
                <motion.div
                  whileHover={{ scale: 1.09 }}
                  whileTap={{ scale: 0.93 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={`size-11 sm:size-12 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer relative shadow-sm ${
                    isActive
                      ? "bg-[#0A1F44] text-[#E2BD56] dark:bg-[#E2BD56] dark:text-[#0A1F44] ring-2 ring-[#B8861B]/40"
                      : "bg-muted/70 backdrop-blur-md text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="size-5" />
                  <span className="text-[9px] font-bold uppercase leading-none mt-0.5">Home</span>
                </motion.div>
              </Link>
            );
          }

          return (
            <Link key={item.to} to={item.to as string} className="relative group">
              <motion.div
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`relative flex flex-col items-center justify-center px-3 sm:px-4 py-1.5 rounded-full transition-colors cursor-pointer ${
                  isActive
                    ? "text-[#0A1F44] dark:text-white font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="glass-nav-pill"
                    className="absolute inset-0 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className="size-4.5 sm:size-5 relative z-10" />
                <span className="text-[10px] leading-tight mt-0.5 tracking-tight relative z-10 hidden xs:inline">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ========================================================================= */
/* ULTRA-TRANSPARENT, GLASS-LIKE FACULTY SIDEBAR                             */
/* (Simple short terms, prominent sign out, semester removed, manual in settings) */
/* ========================================================================= */
interface FacultySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  signOut: () => Promise<void>;
}

function FacultySidebar({ isOpen, onClose, signOut }: FacultySidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles } = useAuth();

  // Simple, short, direct terms
  const links = [
    { to: "/scan", label: "Scanner", icon: ScanLine, tag: "Live" },
    { to: "/sessions", label: "Sessions", icon: CalendarClock },
    { to: "/courses", label: "Courses", icon: BookOpen },
    { to: "/students", label: "Students", icon: Users },
    { to: "/reports", label: "Reports", icon: FileBarChart },
    { to: "/announcements", label: "Notices", icon: Megaphone },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full backdrop-blur-3xl bg-white/50 dark:bg-[#07162b]/60 text-foreground border-r border-white/30 dark:border-white/10 shadow-2xl select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-border/40">
        <Link to="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-[#0A1F44] p-1 flex items-center justify-center ring-1 ring-[#B8861B]/40 shadow-xs">
            <img src="/qmark_icon_standalone.png" alt="Qmark" className="size-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-foreground">
                Q<span className="text-[#B8861B]">mark</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-[#B8861B]/15 text-[#B8861B]">
                FACULTY
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Attendance</p>
          </div>
        </Link>

        {/* Close button on mobile */}
        <button
          type="button"
          onClick={onClose}
          className="size-8 rounded-lg bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center lg:hidden cursor-pointer"
          aria-label="Close Sidebar"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          Menu
        </p>

        {links.map((item) => {
          const isActive = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as string}
              onClick={onClose}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.tag && (
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 uppercase ${
                    isActive ? "border-primary-foreground/30 text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {item.tag}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>

      {/* User Card & Prominent Sign Out Button */}
      <div className="p-3 border-t border-border/40 bg-black/5 dark:bg-white/5 space-y-2.5">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-card/60 backdrop-blur-md border border-border/50">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
            {user?.email?.charAt(0).toUpperCase() || "F"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground truncate">
              {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Faculty"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        {/* Prominent Sign Out Button in Sidebar as explicitly requested */}
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white font-bold text-xs transition duration-200 cursor-pointer shadow-xs"
        >
          <LogOut className="size-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-30 w-60 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sheet */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Slide-over Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed inset-y-0 left-0 w-68 max-w-[85vw] h-full shadow-2xl z-10"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ========================================================================= */
/* MAIN APP SHELL                                                            */
/* ========================================================================= */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Notification prompt check: ONLY appears once after initial signup
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
    if (typeof window !== "undefined") {
      localStorage.removeItem("qroll_active_gateway");
      localStorage.removeItem("qroll_lecturer_logged_in");
      localStorage.setItem("qroll_logged_out", "true");
    }
    await firebaseAuth.signOut();
    router.navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {user?.id && (
        <NotificationPermissionModal
          open={showNotificationModal}
          onClose={() => setShowNotificationModal(false)}
          userContext={{
            userId: user.id,
            userRole: "lecturer",
          }}
        />
      )}

      {/* The Transparent Glass Sidebar */}
      <FacultySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        signOut={signOut}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        <QmarkTitleBar
          tag="GH"
          user={
            user
              ? {
                  name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Faculty",
                  avatarUrl: user.user_metadata?.avatar_url,
                  email: user.email,
                  role: roles[0] || "Faculty",
                }
              : null
          }
          notificationUserId={user?.id}
          showBack={true}
          showMenuButton={true}
          onToggleSidebar={() => setSidebarOpen(true)}
          onBack={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              navigate({ to: "/dashboard" });
            }
          }}
        />

        <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32 min-w-0">
          {children}
        </main>

        {/* Ultra-transparent Frosted Glass Navbar */}
        <TutorFloatingNav />
      </div>
    </div>
  );
}
