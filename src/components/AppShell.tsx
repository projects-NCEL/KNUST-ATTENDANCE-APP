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
/* ========================================================================= */
/* BALANCED, MODERN FLOATING NAVBAR                                          */
/* (Real-world mobile app proportions, delicate subtle hairline gold accent) */
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

  const isHomeActive = pathname === "/dashboard" || pathname === "/dashboard/";

  return (
    <nav
      className="lg:hidden fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[94vw] pointer-events-auto select-none"
      aria-label="Faculty Navigation"
    >
      {/* Sleek, Ergonomic Glass Container with Scooped Center Notch */}
      <div className="relative flex items-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-full backdrop-blur-3xl bg-white/95 dark:bg-[#07162c]/95 border-2 border-[#D4AF37]/50 dark:border-[#D4AF37]/45 shadow-[0_16px_44px_-6px_rgba(0,0,0,0.32)] dark:shadow-[0_20px_48px_-6px_rgba(0,0,0,0.75)]">
        {/* Top gold hairline */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent" />

        {/* Animated Curved Notch Scoop (Curved In) Cradling the Projecting Home Button */}
        <div className="pointer-events-none absolute -top-[14px] left-1/2 -translate-x-1/2 w-24 sm:w-28 h-4 overflow-visible flex items-center justify-center">
          <svg
            className="w-24 sm:w-28 h-4 overflow-visible"
            viewBox="0 0 120 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="goldBeamFaculty" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#FFF2B2" stopOpacity="1" />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            {/* Curved-in concave scoop fill seamlessly matching navbar glass */}
            <path
              d="M 0,0 C 26,0 34,18 60,18 C 86,18 94,0 120,0"
              className="fill-transparent stroke-[#D4AF37]/60 dark:stroke-[#D4AF37]/55 stroke-[2.5]"
              strokeLinecap="round"
            />
            {/* Glowing animated accent beam continuously running across the curved notch */}
            <motion.path
              d="M 0,0 C 26,0 34,18 60,18 C 86,18 94,0 120,0"
              fill="none"
              stroke="url(#goldBeamFaculty)"
              strokeWidth="3.5"
              strokeLinecap="round"
              initial={{ pathLength: 0.35, pathOffset: 0 }}
              animate={{ pathOffset: [0, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
              className="drop-shadow-[0_0_8px_rgba(212,175,55,0.85)]"
            />
          </svg>
        </div>

        {navItems.map((item) => {
          const isActive =
            item.to === "/dashboard"
              ? isHomeActive
              : pathname.startsWith(item.to);
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <Link key={item.to} to={item.to as string} className="relative group mx-1.5 sm:mx-2.5">
                {/* Home Button Projecting Out Above Navbar on the Curved Scoop */}
                <motion.div
                  whileHover={{ scale: 1.08, y: -22 }}
                  whileTap={{ scale: 0.92, y: -16 }}
                  animate={{ y: -18 }}
                  transition={{ type: "spring", stiffness: 450, damping: 22 }}
                  className="relative cursor-pointer flex flex-col items-center justify-center"
                >
                  {/* Pulsing gold ambient glow ring */}
                  <span className="absolute -inset-1.5 rounded-full bg-[#D4AF37]/35 blur-md animate-pulse" />

                  {/* Projected Circular Button */}
                  <div
                    className={`size-[52px] sm:size-14 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative border-[2.5px] ${
                      isActive
                        ? "bg-[#0A1F44] text-[#E2BD56] border-[#D4AF37] ring-4 ring-[#D4AF37]/45 shadow-[0_12px_28px_rgba(212,175,55,0.55)]"
                        : "bg-[#0A1F44] text-[#F3DB8B] border-[#D4AF37]/85 ring-2 ring-[#D4AF37]/30 shadow-[0_10px_24px_rgba(0,0,0,0.4)] hover:border-[#D4AF37]"
                    }`}
                  >
                    <Icon className="size-5 sm:size-6 stroke-[3] drop-shadow-sm" />
                    <span className="text-[9px] sm:text-[10px] font-black uppercase leading-none mt-0.5 tracking-wider text-[#E2BD56]">
                      Home
                    </span>
                  </div>
                </motion.div>
              </Link>
            );
          }

          return (
            <Link key={item.to} to={item.to as string} className="relative group">
              <motion.div
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`relative flex flex-col items-center justify-center px-2.5 sm:px-4 py-1.5 rounded-full transition-all cursor-pointer min-w-[52px] sm:min-w-[64px] ${
                  isActive
                    ? "text-[#0A1F44] dark:text-[#E2BD56] font-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#D4AF37]/15 font-bold"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="glass-nav-pill"
                    className="absolute inset-0 rounded-full bg-[#D4AF37]/25 dark:bg-[#D4AF37]/30 border-[1.5px] border-[#D4AF37]/65 shadow-xs"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                )}
                <Icon className={`size-5 sm:size-[22px] relative z-10 ${isActive ? "stroke-[3]" : "stroke-[2.6]"}`} />
                <span className="text-[10px] sm:text-[11px] font-black leading-tight mt-0.5 tracking-tight relative z-10 uppercase">
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
    <div className="flex flex-col h-full backdrop-blur-3xl bg-white/80 dark:bg-[#07162b]/85 text-foreground border-r border-white/50 dark:border-white/15 shadow-2xl select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-border/40">
        <Link to="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-white/90 dark:bg-white/10 p-1 flex items-center justify-center ring-1 ring-border shadow-xs">
            <img src="/qmark_icon_standalone.png" alt="Qmark" className="size-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-foreground">
                Qmark
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                FACULTY
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">Attendance & Records</p>
          </div>
        </Link>

        {/* Close button visible whenever drawer is open */}
        <button
          type="button"
          onClick={onClose}
          className="size-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop for all screen sizes */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Slide-over Panel that pops out on click */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] h-full shadow-2xl z-10"
          >
            {sidebarContent}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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

      {/* The Transparent Glass Sidebar - pops out only on button click for all screen sizes */}
      <FacultySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        signOut={signOut}
      />

      {/* Main Content Area - Full width on all screen sizes */}
      <div className="flex-1 flex flex-col min-w-0">
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

        <main className="flex-1 w-full max-w-5xl lg:max-w-[97vw] xl:max-w-[98vw] 2xl:max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 xl:px-10 pb-24 sm:pb-28 lg:pb-8 min-w-0">
          {children}
        </main>

        {/* Floating navbar: phones and tablets only, hidden from lg screens up */}
        <TutorFloatingNav />
      </div>
    </div>
  );
}
