import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  QrCode,
  Radio,
  Home,
  BookOpen,
  Megaphone,
} from "lucide-react";

interface StudentFloatingNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeSessionId?: string | null;
}

export function StudentFloatingNav({
  activeTab,
  onTabChange,
  activeSessionId,
}: StudentFloatingNavProps) {
  const leftItems = [
    { id: "qr", label: "My Pass", icon: QrCode },
    {
      id: "checkin",
      label: "Check In",
      icon: Radio,
      to: activeSessionId ? `/check-in?session=${activeSessionId}` : "/check-in",
      isLive: Boolean(activeSessionId),
    },
  ];

  const rightItems = [
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "announcements", label: "Notices", icon: Megaphone },
  ];

  const isHomeActive = activeTab === "attendance";

  return (
    <motion.nav
      initial={{ y: 80, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] pointer-events-auto select-none"
      aria-label="Student Floating Navigation"
    >
      <div className="relative flex items-center gap-1.5 sm:gap-3 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full backdrop-blur-2xl bg-white/90 dark:bg-[#0A1F44]/90 border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_-6px_rgba(10,31,68,0.18)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)]">
        {/* Subtle interior sheen */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#B8861B]/40 to-transparent" />

        {/* Left Items: Pass & Check In */}
        {leftItems.map((item) => {
          const isActive = item.to ? false : activeTab === item.id;
          const Icon = item.icon;

          if (item.to) {
            return (
              <Link key={item.id} to={item.to as string} className="relative group">
                <motion.div
                  whileHover={{ scale: 1.06, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  className="relative flex flex-col items-center justify-center px-3 sm:px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-slate-100/80 dark:hover:bg-white/10"
                >
                  {item.isLive && (
                    <span className="absolute top-1 right-2 size-2 rounded-full bg-[#B8861B] ring-2 ring-white dark:ring-[#0A1F44] animate-pulse" />
                  )}
                  <Icon className="size-4.5 sm:size-5 shrink-0" />
                  <span className="text-[10px] sm:text-xs font-semibold leading-tight mt-0.5 tracking-tight hidden xs:inline">
                    {item.label}
                  </span>
                </motion.div>
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className="relative group cursor-pointer"
            >
              <motion.div
                whileHover={{ scale: 1.06, y: -1 }}
                whileTap={{ scale: 0.94 }}
                className={`relative flex flex-col items-center justify-center px-3 sm:px-4 py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? "text-[#0A1F44] dark:text-[#E2BD56] font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-slate-100/80 dark:hover:bg-white/10"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="student-nav-indicator"
                    className="absolute inset-0 rounded-full bg-slate-100 dark:bg-white/10 border border-[#B8861B]/30"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={`size-4.5 sm:size-5 shrink-0 z-10 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span className="text-[10px] sm:text-xs font-semibold leading-tight mt-0.5 tracking-tight z-10 hidden xs:inline">
                  {item.label}
                </span>
              </motion.div>
            </button>
          );
        })}

        {/* Center Prominent Item: Home (Attendance) */}
        <button
          type="button"
          onClick={() => onTabChange("attendance")}
          className="relative group mx-1 sm:mx-2 cursor-pointer"
        >
          <motion.div
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.94 }}
            className="relative flex flex-col items-center justify-center cursor-pointer"
          >
            <div
              className={`relative size-12 sm:size-13 rounded-full flex flex-col items-center justify-center transition-all duration-200 shadow-sm ${
                isHomeActive
                  ? "bg-[#0A1F44] text-[#E2BD56] ring-2 ring-[#B8861B] shadow-md"
                  : "bg-slate-100 dark:bg-[#132C57] text-foreground hover:text-[#B8861B] ring-1 ring-slate-200 dark:ring-white/10"
              }`}
            >
              <Home className={`size-5 sm:size-5.5 shrink-0 ${isHomeActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-[9px] font-bold leading-none mt-0.5 tracking-tight uppercase">
                Home
              </span>
            </div>
          </motion.div>
        </button>

        {/* Right Items: Courses & Notices */}
        {rightItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className="relative group cursor-pointer"
            >
              <motion.div
                whileHover={{ scale: 1.06, y: -1 }}
                whileTap={{ scale: 0.94 }}
                className={`relative flex flex-col items-center justify-center px-3 sm:px-4 py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? "text-[#0A1F44] dark:text-[#E2BD56] font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-slate-100/80 dark:hover:bg-white/10"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="student-nav-indicator"
                    className="absolute inset-0 rounded-full bg-slate-100 dark:bg-white/10 border border-[#B8861B]/30"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={`size-4.5 sm:size-5 shrink-0 z-10 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span className="text-[10px] sm:text-xs font-semibold leading-tight mt-0.5 tracking-tight z-10 hidden xs:inline">
                  {item.label}
                </span>
              </motion.div>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
