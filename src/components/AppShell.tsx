import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LogOut,
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarClock,
  ScanLine,
  FileBarChart,
  Building2,
  Menu,
  Settings,
  CreditCard,
  FileText,
  Shield,
  CalendarRange,
  History,
  Megaphone,
  ClipboardList,
  ArrowLeft,
  Home,
} from "lucide-react";
import { motion } from "motion/react";
import { firebaseAuth } from "@/integrations/firebase/config";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { KnustEmblem } from "@/components/KnustEmblem";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};
const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users, adminOnly: true },
  { to: "/courses", label: "Courses", icon: BookOpen, adminOnly: true },
  {
    to: "/departments",
    label: "Departments",
    icon: Building2,
    adminOnly: true,
  },
  {
    to: "/semesters",
    label: "Semesters",
    icon: CalendarRange,
    adminOnly: true,
  },
  { to: "/sessions", label: "Sessions", icon: CalendarClock },
  { to: "/scan", label: "Scanner", icon: ScanLine },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/history", label: "Academic History", icon: History },
  { to: "/announcements", label: "Announcements & Tasks", icon: Megaphone },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({
  isAdmin,
  onNavigate,
}: {
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 p-2">
      {nav
        .filter((n) => !n.adminOnly || isAdmin)
        .map((n) => {
          const active = pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to as string}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/20 text-white"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              <n.icon className="size-4 shrink-0" /> {n.label}
            </Link>
          );
        })}
    </nav>
  );
}

function SidebarBody({
  email,
  role,
  onSignOut,
  isAdmin,
  onNavigate,
}: {
  email?: string;
  role: string;
  onSignOut: () => void;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-knust-gradient text-primary-foreground">
      <div className="px-5 py-5 flex items-center gap-3.5 border-b border-white/10">
        <div className="size-12 rounded-2xl bg-white/10 p-1 shadow-md flex items-center justify-center shrink-0 border border-white/20">
          <KnustEmblem size={40} />
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-sm font-bold tracking-tight text-white truncate">
            KNUST-ATTENDANCE-APP
          </div>
          <div className="text-xs text-white/80 truncate">
            Academic Attendance System
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavLinks isAdmin={isAdmin} onNavigate={onNavigate} />
      </div>
      <div className="px-2 pt-3 pb-2 border-t border-white/10">
        <div className="px-2 pb-1.5 text-[10px] uppercase tracking-wider text-white/50 font-semibold">
          Help & Legal
        </div>
        <Link
          to={"/manual" as string}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white transition-colors"
        >
          <BookOpen className="size-4 shrink-0" /> App Manual
        </Link>
        <Link
          to={"/terms" as string}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white transition-colors"
        >
          <FileText className="size-4 shrink-0" /> Terms of Service
        </Link>
        <Link
          to={"/privacy" as string}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Shield className="size-4 shrink-0" /> Privacy Policy
        </Link>
      </div>
      <div className="p-3 border-t border-white/10">
        <div className="text-xs opacity-80 truncate">{email}</div>
        <div className="text-[10px] uppercase tracking-wider text-gold/90 mt-0.5">
          {role}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2 w-full"
          onClick={onSignOut}
        >
          <LogOut className="size-4 mr-1" /> Sign out
        </Button>
      </div>
    </div>
  );
}

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
      className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] pointer-events-auto select-none"
      aria-label="Tutor Quick Access Navigation"
    >
      <div className="relative flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full backdrop-blur-xl bg-background/85 dark:bg-card/90 border border-border/70 shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/10">
        {/* Left items: Scanner, Sessions */}
        {leftItems.map((item) => {
          const isActive = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to as string} className="relative group">
              <motion.div
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`relative flex flex-col items-center justify-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="floating-nav-indicator"
                    className="absolute inset-0 rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/30"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="size-4.5 sm:size-5 shrink-0 z-10 transition-transform group-hover:scale-110" />
                <span className="text-[10px] sm:text-[11px] font-semibold leading-tight mt-0.5 tracking-tight z-10 hidden xs:inline">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}

        {/* Center item: Home (Dashboard) */}
        <Link to={"/dashboard" as string} className="relative group mx-0.5 sm:mx-1">
          <motion.div
            whileHover={{ scale: 1.12, y: -3 }}
            whileTap={{ scale: 0.9 }}
            className="relative flex flex-col items-center justify-center cursor-pointer"
          >
            <div
              className={`size-11 sm:size-12 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 ${
                isHomeActive
                  ? "bg-gradient-to-tr from-[#00381c] via-[#00552b] to-[#007a3d] text-white ring-4 ring-primary/25 shadow-primary/30 scale-105"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/25"
              }`}
            >
              <Home className="size-5 sm:size-5.5 shrink-0" />
              <span className="text-[9px] font-bold leading-none mt-0.5 tracking-tight">
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
                className={`relative flex flex-col items-center justify-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="floating-nav-indicator"
                    className="absolute inset-0 rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/30"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="size-4.5 sm:size-5 shrink-0 z-10 transition-transform group-hover:scale-110" />
                <span className="text-[10px] sm:text-[11px] font-semibold leading-tight mt-0.5 tracking-tight z-10 hidden xs:inline">
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
  const { user, isAdmin, roles } = useAuth();
  const [open, setOpen] = useState(false);
  const [deviceLimitOpen, setDeviceLimitOpen] = useState(false);
  const [activeDevices, setActiveDevices] = useState<UserDevice[]>([]);
  const role = roles[0] ?? "no role";

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
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open menu"
                  className="shrink-0 size-9"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 max-w-[85vw]">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <SidebarBody
                  email={user?.email}
                  role={role}
                  onSignOut={() => {
                    setOpen(false);
                    void signOut();
                  }}
                  isAdmin={isAdmin}
                  onNavigate={() => setOpen(false)}
                />
              </SheetContent>
            </Sheet>

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
        <div className="flex-1 w-full max-w-[1400px] mx-auto p-3.5 sm:p-6 lg:p-8 pb-28 sm:pb-32 min-w-0">
          {children}
        </div>

        {/* Tutor Dynamic Animated Quick Access Floating Bar */}
        <TutorFloatingNav />
      </main>
    </div>
  );
}
